/**
 * @file vision.cpp
 * @brief Vision 模块实现
 *
 * 严格对应 docs/arch/vision.md 函数规范。
 * 封装 OCR、VLM 图像分析、Embedding 生成的完整调用逻辑。
 */

#include "vision/vision.hpp"

#include "error_codes.hpp"
#include "utils/logger.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <memory>
#include <nlohmann/json.hpp>
#include <sstream>
#include <stdexcept>
#include <string_view>
#include <thread>

// stb_image 用于图像加载和缩放
#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include <stb_image_write.h>
#define STB_IMAGE_RESIZE_IMPLEMENTATION
#include <stb_image_resize2.h>

namespace quickmemes {

// ── Base64 编码表 ──
static const char base64Chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string base64Encode(const unsigned char *data, size_t len) {
	std::string result;
	result.resize_and_overwrite(((len + 2) / 3) * 4, [&](char *buf, size_t /* n */) {
		size_t outIdx = 0;
		for (size_t i = 0; i < len; i += 3) {
			unsigned int triple = (data[i] << 16);
			if (i + 1 < len) triple |= (data[i + 1] << 8);
			if (i + 2 < len) triple |= data[i + 2];

			buf[outIdx++] = base64Chars[(triple >> 18) & 0x3F];
			buf[outIdx++] = base64Chars[(triple >> 12) & 0x3F];
			buf[outIdx++] = (i + 1 < len) ? base64Chars[(triple >> 6) & 0x3F] : '=';
			buf[outIdx++] = (i + 2 < len) ? base64Chars[triple & 0x3F] : '=';
		}
		return outIdx;
	});
	return result;
}

// ── stb_image_write 回调用于将 PNG 写入内存 ──
static void stbiWriteCallback(void *context, void *data, int size) {
	auto *vec   = static_cast<std::vector<unsigned char> *>(context);
	auto *bytes = static_cast<unsigned char *>(data);
	vec->insert(vec->end(), bytes, bytes + size);
}

static std::string toLowerCopy(std::string value) {
	std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
		return static_cast<char>(std::tolower(c));
	});
	return value;
}

static std::string trimCopy(std::string_view s) {
	auto first = std::find_if(s.begin(), s.end(), [](unsigned char c) { return !std::isspace(c); });
	auto last  = std::find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !std::isspace(c); }).base();
	return (first < last) ? std::string(first, last) : "";
}

static bool isGifImage(const std::string &imagePath) {
	auto ext = toLowerCopy(std::filesystem::path(imagePath).extension().string());
	return ext == ".gif";
}

static bool isPdfFile(const std::string &imagePath) {
	auto ext = toLowerCopy(std::filesystem::path(imagePath).extension().string());
	return ext == ".pdf";
}

static int extractHttpStatusCode(const std::string &message) {
	auto pos = message.find("returned ");
	if (pos == std::string::npos) { return 0; }
	pos += 9;

	int code = 0;
	for (; pos < message.size(); ++pos) {
		if (!std::isdigit(static_cast<unsigned char>(message[pos]))) { break; }
		code = code * 10 + (message[pos] - '0');
	}
	return code;
}

static bool shouldRetryVisionRequest(const ApiException &e) {
	const std::string message = e.what();
	if (message.find("timeout") != std::string::npos || message.find("timed out") != std::string::npos) { return true; }

	int status = extractHttpStatusCode(message);
	if (status == 429) { return true; }
	if (status >= 500 && status <= 599) { return true; }
	return false;
}

static std::string normalizeOcrProvider(const std::string &provider) {
	return toLowerCopy(trimCopy(provider));
}

static bool isPaddleOcrProvider(const std::string &provider) {
	auto normalized = normalizeOcrProvider(provider);
	return normalized == "paddleocr" || normalized == "paddle_ocr" || normalized == "pp-ocr" || normalized == "pp_ocr";
}

static bool isOcrSpaceProvider(const std::string &provider) {
	return normalizeOcrProvider(provider) == "ocrspace";
}

static std::string urlEncode(std::string_view value) {
	std::string encoded;
	encoded.reserve(value.size() * 1.2); // 预估避免扩容
	const char  hex_chars[] = "0123456789ABCDEF";
	for (unsigned char c : value) {
		if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' ||
		    c == '.' || c == '~') {
			encoded.push_back(static_cast<char>(c));
		} else if (c == ' ') {
			encoded.push_back('+');
		} else {
			encoded.push_back('%');
			encoded.push_back(hex_chars[c >> 4]);
			encoded.push_back(hex_chars[c & 0x0F]);
		}
	}
	return encoded;
}

static std::string normalizePaddleOcrUrl(const std::string &ocrApiUrl) {
	auto pathEnd = ocrApiUrl.find_first_of("?#");
	auto path    = pathEnd == std::string::npos ? ocrApiUrl : ocrApiUrl.substr(0, pathEnd);
	if (path.size() >= 4 && path.compare(path.size() - 4, 4, "/ocr") == 0) { return ocrApiUrl; }
	if (path.size() >= 5 && path.compare(path.size() - 5, 5, "/ocr/") == 0) { return ocrApiUrl; }
	if (!ocrApiUrl.empty() && ocrApiUrl.back() == '/') { return ocrApiUrl + "ocr"; }
	return ocrApiUrl + "/ocr";
}

static std::string normalizeOcrSpaceUrl(const std::string &ocrApiUrl) {
	if (ocrApiUrl.find("/parse/imageurl") != std::string::npos) {
		return std::string(ocrApiUrl).replace(ocrApiUrl.find("/parse/imageurl"),
		                                      std::string("/parse/imageurl").size(),
		                                      "/parse/image");
	}
	if (ocrApiUrl.find("/parse/image") != std::string::npos) { return ocrApiUrl; }
	if (!ocrApiUrl.empty() && ocrApiUrl.back() == '/') { return ocrApiUrl + "parse/image"; }
	return ocrApiUrl + "/parse/image";
}

static std::string jsonValueToString(const nlohmann::json &value) {
	if (value.is_null()) { return ""; }
	if (value.is_string()) { return value.get<std::string>(); }
	if (value.is_array()) {
		std::string joined;
		for (const auto &item : value) {
			if (item.is_string()) {
				if (!joined.empty()) { joined += ", "; }
				joined += item.get<std::string>();
			}
		}
		return joined;
	}
	return value.dump();
}

static std::string buildOcrSpaceRequestBody(const std::string &base64Image) {
	std::string body;
	// 提前计算总容量，消除运行期所有扩容
	body.reserve(100 + base64Image.size() * 1.1);
	body += "base64Image=";
	body += urlEncode("data:image/jpeg;base64,");
	body += urlEncode(base64Image); // 避免大字符串拼接直接传参
	body += "&language=chs&isOverlayRequired=false&detectOrientation=true&scale=true&OCREngine=2";
	return body;
}

static std::string buildOcrSpaceHeaders(const std::string &apiKey) {
	return "apikey: " + apiKey + "\r\nContent-Type: application/x-www-form-urlencoded\r\n";
}

static std::string buildPaddleOcrRequestBody(const std::string &base64Image) {
	nlohmann::json body;
	body["file"]                      = base64Image;
	body["fileType"]                  = 1;
	body["useDocOrientationClassify"] = false;
	body["useDocUnwarping"]           = false;
	body["useTextlineOrientation"]    = false;
	body["visualize"]                 = false;
	return body.dump();
}

static std::string buildPaddleOcrHeaders(const std::string &apiKey) {
	return "Authorization: token " + apiKey + "\r\nContent-Type: application/json\r\n";
}

static void appendTrimmedText(std::vector<std::string> &texts, const nlohmann::json &value) {
	if (!value.is_string()) { return; }
	auto text = trimCopy(value.get<std::string>());
	if (!text.empty()) { texts.push_back(text); }
}

static std::vector<std::string> extractPaddlePageTexts(const nlohmann::json &ocrItem) {
	std::vector<std::string> pageTexts;

	const nlohmann::json *prunedResult = nullptr;
	if (ocrItem.contains("prunedResult") && ocrItem["prunedResult"].is_object()) {
		prunedResult = &ocrItem["prunedResult"];
	} else if (ocrItem.is_object()) {
		prunedResult = &ocrItem;
	}

	if (!prunedResult) { return pageTexts; }

	if (prunedResult->contains("res") && (*prunedResult)["res"].is_object()) {
		const auto &res = (*prunedResult)["res"];
		if (res.contains("rec_texts") && res["rec_texts"].is_array()) {
			for (const auto &line : res["rec_texts"]) {
				appendTrimmedText(pageTexts, line);
			}
			return pageTexts;
		}
	}

	if (prunedResult->contains("rec_texts") && (*prunedResult)["rec_texts"].is_array()) {
		for (const auto &line : (*prunedResult)["rec_texts"]) {
			appendTrimmedText(pageTexts, line);
		}
	}

	return pageTexts;
}

static std::string joinTexts(const std::vector<std::string> &texts) {
	std::string result;
	for (const auto &text : texts) {
		if (text.empty()) { continue; }
		if (!result.empty()) { result += "\n"; }
		result += text;
	}
	return result;
}

static OcrResult parsePaddleOcrResponse(const std::string &responseBody) {
	OcrResult res;

	auto respJson = nlohmann::json::parse(responseBody);
	if (!respJson.is_object()) {
		res.error = "Invalid PaddleOCR response format";
		return res;
	}

	if (respJson.contains("errorCode") && !respJson["errorCode"].is_null()) {
		int errorCode = 0;
		if (respJson["errorCode"].is_number_integer()) {
			errorCode = respJson["errorCode"].get<int>();
		} else if (respJson["errorCode"].is_string()) {
			errorCode = std::stoi(respJson["errorCode"].get<std::string>());
		}

		if (errorCode != 0) {
			std::string message;
			if (respJson.contains("errorMsg") && respJson["errorMsg"].is_string()) {
				message = trimCopy(respJson["errorMsg"].get<std::string>());
			}
			if (message.empty()) { message = "PaddleOCR processing failed"; }
			res.error = message;
			return res;
		}
	}

	if (!respJson.contains("result") || !respJson["result"].is_object()) {
		res.error = "Invalid PaddleOCR response format";
		return res;
	}

	const auto &result = respJson["result"];
	if (!result.contains("ocrResults") || !result["ocrResults"].is_array()) {
		res.error = "Invalid PaddleOCR response format";
		return res;
	}

	std::vector<std::string> pageTexts;
	for (const auto &item : result["ocrResults"]) {
		auto texts = extractPaddlePageTexts(item);
		auto page  = joinTexts(texts);
		if (!page.empty()) { pageTexts.push_back(page); }
	}

	res.fullText = joinTexts(pageTexts);
	res.success  = true;
	return res;
}

VisionModule::VisionModule(std::shared_ptr<HttpClientInterface> httpClient)
{
	if (!httpClient) {
		httpClient = std::make_shared<HttpClient>();
	}
	state_.httpClient = std::move(httpClient);
}

VisionModule::~VisionModule() = default;

VisionModule::RuntimeState VisionModule::buildState(const VisionConfig &config,
                                                    std::shared_ptr<HttpClientInterface> client,
                                                    bool                                 allowUnavailable) {
	if (!client) {
		throw std::invalid_argument("Vision http client must not be null");
	}

	VisionConfig normalized = config;
	if (normalized.timeoutSeconds <= 0) {
		if (!allowUnavailable) { throw std::invalid_argument("Vision timeoutSeconds must be positive"); }
		normalized.timeoutSeconds = 30;
	}
	if (normalized.maxRetries < 0) {
		if (!allowUnavailable) { throw std::invalid_argument("Vision maxRetries must be non-negative"); }
		normalized.maxRetries = 0;
	}

	RuntimeState nextState;
	nextState.config     = normalized;
	nextState.httpClient = std::move(client);

	if (!nextState.config.apiKey.empty() && !nextState.config.apiBaseUrl.empty()) {
		try {
			std::string probeUrl   = nextState.config.apiBaseUrl + "/models";
			std::string authHeader = "Authorization: Bearer " + nextState.config.apiKey + "\r\n";
			nextState.httpClient->get(probeUrl, authHeader, nextState.config.timeoutSeconds);
			nextState.isAiAvailable = true;
			LOG_INFO("vision", "AI service probe succeeded.");
		} catch (const std::exception &e) {
			LOG_WARN("vision", std::string("AI service probe failed: ") + e.what());
			nextState.isAiAvailable = false;
		}
	}

	nextState.isOcrAvailable = (!nextState.config.ocrApiUrl.empty() &&
	                            (isPaddleOcrProvider(nextState.config.ocrProvider) ||
	                             (isOcrSpaceProvider(nextState.config.ocrProvider) && !nextState.config.ocrApiKey.empty())));
	if (!nextState.config.ocrProvider.empty() && !isPaddleOcrProvider(nextState.config.ocrProvider) &&
	    !isOcrSpaceProvider(nextState.config.ocrProvider)) {
		LOG_WARN("vision",
		         "Unsupported OCR provider: " + nextState.config.ocrProvider +
		             ". Only PaddleOCR / OcrSpace are enabled.");
		if (!allowUnavailable &&
		    !nextState.config.ocrProvider.empty()) {
			throw std::invalid_argument("Unsupported OCR provider: " + nextState.config.ocrProvider);
		}
	}

	return nextState;
}

void VisionModule::setHttpClient(std::shared_ptr<HttpClientInterface> client) {
	if (!client) { throw std::invalid_argument("Vision http client must not be null"); }

	std::unique_lock lock(stateMutex_);
	state_.httpClient = std::move(client);
}

bool VisionModule::initialize(const VisionConfig &config) {
	std::shared_ptr<HttpClientInterface> client;
	{
		std::shared_lock lock(stateMutex_);
		client = state_.httpClient;
	}

	auto nextState = buildState(config, std::move(client), true);
	{
		std::unique_lock lock(stateMutex_);
		state_ = nextState;
	}

	LOG_INFO("vision",
	         "VisionModule initialized — AI: " + std::string(nextState.isAiAvailable ? "available" : "unavailable") +
	             ", OCR: " + std::string(nextState.isOcrAvailable ? "available" : "unavailable"));

	return nextState.isAiAvailable || nextState.isOcrAvailable;
}

void VisionModule::shutdown() {
	std::unique_lock lock(stateMutex_);
	state_.isAiAvailable  = false;
	state_.isOcrAvailable = false;
	LOG_INFO("vision", "VisionModule shutdown.");
}

bool VisionModule::reconfigure(const VisionConfig &newConfig) {
	std::shared_ptr<HttpClientInterface> client;
	{
		std::shared_lock lock(stateMutex_);
		client = state_.httpClient;
	}

	try {
		auto nextState = buildState(newConfig, std::move(client), false);
		{
			std::unique_lock lock(stateMutex_);
			state_ = nextState;
		}
		LOG_INFO("vision",
		         "VisionModule reconfigured — AI: " +
		             std::string(nextState.isAiAvailable ? "available" : "unavailable") + ", OCR: " +
		             std::string(nextState.isOcrAvailable ? "available" : "unavailable"));
		return true;
	} catch (const std::exception &e) {
		LOG_WARN("vision", std::string("VisionModule reconfigure rejected: ") + e.what());
		return false;
	}
}

bool VisionModule::isAvailable() const {
	std::shared_lock lock(stateMutex_);
	return state_.isAiAvailable;
}

bool VisionModule::isOcrAvailable() const {
	std::shared_lock lock(stateMutex_);
	return state_.isOcrAvailable;
}

OcrResult VisionModule::recognize(const std::string &imagePath) {
	OcrResult res;
	RuntimeState stateSnapshot;
	{
		std::shared_lock lock(stateMutex_);
		stateSnapshot = state_;
	}

	if (isPdfFile(imagePath)) {
		res.success = false;
		res.error   = "PDF input is not supported";
		LOG_WARN("vision", "OCR recognize rejected: PDF input is not supported: " + imagePath);
		return res;
	}

	if (!isPaddleOcrProvider(stateSnapshot.config.ocrProvider) && !isOcrSpaceProvider(stateSnapshot.config.ocrProvider)) {
		res.success = false;
		res.error   = stateSnapshot.config.ocrProvider.empty() ? "OCR provider not configured"
		                                                      : "Unsupported OCR provider: " + stateSnapshot.config.ocrProvider;
		LOG_WARN("vision", "OCR recognize skipped: " + res.error);
		return res;
	}

	if (!stateSnapshot.isOcrAvailable) {
		res.success = false;
		res.error   = "OCR service unavailable";
		LOG_WARN("vision", "OCR recognize skipped: OCR service unavailable.");
		return res;
	}

	if (isGifImage(imagePath)) {
		res.success = true;
		res.fullText.clear();
		res.error.clear();
		LOG_INFO("vision", "GIF image skipped for OCR: " + imagePath);
		return res;
	}

	std::string imageBase64 = encodeImageToBase64(imagePath);
	if (imageBase64.empty()) {
		res.success = false;
		res.error   = "Failed to encode image";
		return res;
	}

	std::string url;
	std::string body;
	std::string headers;
	std::string providerLabel;
	if (isPaddleOcrProvider(stateSnapshot.config.ocrProvider)) {
		url           = normalizePaddleOcrUrl(stateSnapshot.config.ocrApiUrl);
		body          = buildPaddleOcrRequestBody(imageBase64);
		headers       = buildPaddleOcrHeaders(stateSnapshot.config.ocrApiKey);
		providerLabel = "PaddleOCR";
	} else {
		url           = normalizeOcrSpaceUrl(stateSnapshot.config.ocrApiUrl);
		body          = buildOcrSpaceRequestBody(imageBase64);
		headers       = buildOcrSpaceHeaders(stateSnapshot.config.ocrApiKey);
		providerLabel = "OcrSpace";
	}

	std::string responseBody;
	int         retries = stateSnapshot.config.maxRetries;
	for (int attempt = 0; attempt <= retries; ++attempt) {
		try {
			responseBody = stateSnapshot.httpClient->post(url, headers, body, stateSnapshot.config.timeoutSeconds);
			break;
		} catch (const ApiException &e) {
			if (attempt == retries || !shouldRetryVisionRequest(e)) {
				LOG_ERROR("vision", providerLabel + " request failed after retries: " + std::string(e.what()));
				res.success = false;
				res.error   = e.what();
				return res;
			}
			auto backoffMs = 500ULL * (1ULL << attempt);
			backoffMs = std::min(backoffMs, 30000ULL);
			std::this_thread::sleep_for(std::chrono::milliseconds(backoffMs));
		}
	}

	try {
		if (isPaddleOcrProvider(stateSnapshot.config.ocrProvider)) {
			auto parsed = parsePaddleOcrResponse(responseBody);
			if (!parsed.success && parsed.error.empty()) { parsed.error = "Failed to parse PaddleOCR response"; }
			return parsed;
		}

		auto respJson = nlohmann::json::parse(responseBody);
		int  exitCode = 0;
		if (respJson.contains("OCRExitCode")) {
			if (respJson["OCRExitCode"].is_number_integer()) {
				exitCode = respJson["OCRExitCode"].get<int>();
			} else if (respJson["OCRExitCode"].is_string()) {
				exitCode = std::stoi(respJson["OCRExitCode"].get<std::string>());
			}
		}

		bool isErrored = false;
		if (respJson.contains("IsErroredOnProcessing")) { isErrored = respJson["IsErroredOnProcessing"].get<bool>(); }
		if (isErrored || exitCode >= 3) {
			std::string message;
			if (respJson.contains("ErrorMessage")) { message = jsonValueToString(respJson["ErrorMessage"]); }
			if (respJson.contains("ErrorDetails")) {
				auto details = jsonValueToString(respJson["ErrorDetails"]);
				if (!details.empty()) {
					if (!message.empty()) message += ": ";
					message += details;
				}
			}
			if (message.empty()) { message = "OCR.Space processing failed"; }
			res.success = false;
			res.error   = message;
			return res;
		}

		if (!respJson.contains("ParsedResults") || !respJson["ParsedResults"].is_array()) {
			res.success = false;
			res.error   = "Invalid OCR.Space response format";
			return res;
		}

		std::vector<std::string> parsedTexts;
		for (const auto &item : respJson["ParsedResults"]) {
			if (item.contains("ParsedText") && item["ParsedText"].is_string()) {
				auto text = trimCopy(item["ParsedText"].get<std::string>());
				if (!text.empty()) { parsedTexts.push_back(text); }
			}
		}

		res.fullText = joinTexts(parsedTexts);
		res.success  = true;
		res.error.clear();
		return res;
	} catch (const std::exception &e) {
		LOG_WARN("vision", std::string("Failed to parse ") + providerLabel + " response: " + std::string(e.what()));
		res.success = false;
		res.error   = std::string("Failed to parse ") + providerLabel + " response";
		return res;
	}
}

AiAnalysisResult VisionModule::analyzeImage(const std::string &imagePath, const std::string &ocrFullText) {
	AiAnalysisResult res;
	RuntimeState     stateSnapshot;
	{
		std::shared_lock lock(stateMutex_);
		stateSnapshot = state_;
	}

	if (isPdfFile(imagePath)) {
		res.success = false;
		res.error   = "PDF input is not supported";
		LOG_WARN("vision", "AI analyze rejected: PDF input is not supported: " + imagePath);
		return res;
	}

	if (!stateSnapshot.isAiAvailable) {
		res.success = false;
		res.error   = "AI service unavailable";
		return res;
	}

	std::string imageBase64 = encodeImageToBase64(imagePath);
	if (imageBase64.empty()) {
		res.success = false;
		res.error   = "Failed to encode image";
		return res;
	}

	std::string systemPrompt = "你是一个图片分析助手。请分析用户提供的图片，用中文输出：\n"
	                           "1. 最多10个描述标签（tags）\n"
	                           "2. 一句简短的图片描述（description）\n"
	                           "请严格按以下 JSON 格式输出：\n"
	                           "{\"tags\": [\"标签1\", \"标签2\"], \"description\": \"描述文本\"}";

	std::string userText = "分析这张图片";
	if (!ocrFullText.empty()) { userText += "，图片中的 OCR 文本为：" + ocrFullText; }

	nlohmann::json requestBody;
	requestBody["model"]      = stateSnapshot.config.visionModel;
	requestBody["messages"]   = nlohmann::json::array({
	    {{"role", "system"},{"content", systemPrompt}                      },
	    {  {"role", "user"},
	     {"content",
         nlohmann::json::array(
         {{{"type", "image_url"}, {"image_url", {{"url", "data:image/jpeg;base64," + imageBase64}}}},
         {{"type", "text"}, {"text", userText}}})}}
    });
	requestBody["max_tokens"] = 1000;

	std::string url     = stateSnapshot.config.apiBaseUrl + "/chat/completions";
	std::string headers = "Authorization: Bearer " + stateSnapshot.config.apiKey + "\r\n";

	std::string requestPayload = requestBody.dump();
	std::string responseBody;
	int         retries = stateSnapshot.config.maxRetries;
	for (int attempt = 0; attempt <= retries; ++attempt) {
		try {
			responseBody =
			    stateSnapshot.httpClient->post(url, headers, requestPayload, stateSnapshot.config.timeoutSeconds);
			break;
		} catch (const ApiException &e) {
			if (attempt == retries || !shouldRetryVisionRequest(e)) {
				LOG_ERROR("vision", "analyzeImage failed after retries: " + std::string(e.what()));
				res.success = false;
				res.error   = e.what();
				return res;
			}
			auto backoffMs = 500ULL * (1ULL << attempt);
			backoffMs = std::min(backoffMs, 30000ULL);
			std::this_thread::sleep_for(std::chrono::milliseconds(backoffMs));
		}
	}

	try {
		auto respJson = nlohmann::json::parse(responseBody);
		if (!respJson.contains("choices") || !respJson["choices"].is_array() || respJson["choices"].empty()) {
			LOG_WARN("vision", "VLM response missing choices or empty.");
			res.success = false;
			res.error   = "Invalid VLM response format";
			return res;
		}

		auto &message = respJson["choices"][0]["message"];
		if (!message.contains("content") || !message["content"].is_string()) {
			LOG_WARN("vision", "VLM response missing content field.");
			res.success = false;
			res.error   = "Invalid VLM response content";
			return res;
		}

		std::string      content = message["content"].get<std::string>();
		std::string_view view    = content;

		auto ltrim_v = [](std::string_view &s) {
			auto pos = std::find_if(s.begin(), s.end(), [](unsigned char c) { return !std::isspace(c); });
			s.remove_prefix(std::distance(s.begin(), pos));
		};
		auto rtrim_v = [](std::string_view &s) {
			auto pos = std::find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !std::isspace(c); });
			s.remove_suffix(std::distance(s.rbegin(), pos));
		};

		ltrim_v(view);
		rtrim_v(view);

		// 使用 C++ 20/23 特性 starts_with, ends_with 无拷贝判断
		if (view.starts_with("```json")) {
			view.remove_prefix(7);
		} else if (view.starts_with("```")) {
			view.remove_prefix(3);
		}
		if (view.ends_with("```")) { view.remove_suffix(3); }

		ltrim_v(view);
		rtrim_v(view);

		// nlohmann::json 原生支持解析 string_view，无需生成新 string
		auto analysisJson = nlohmann::json::parse(view);

		if (analysisJson.contains("tags") && analysisJson["tags"].is_array()) {
			for (const auto &tag : analysisJson["tags"]) {
				if (tag.is_string() && res.suggestedTags.size() < 10) {
					res.suggestedTags.push_back(tag.get<std::string>());
				}
			}
		}
		if (analysisJson.contains("description") && analysisJson["description"].is_string()) {
			res.description = analysisJson["description"].get<std::string>();
		}

		res.success = true;
	} catch (const std::exception &e) {
		LOG_WARN("vision", "Failed to parse VLM response: " + std::string(e.what()));
		res.success = false;
		res.error   = "Failed to parse VLM response";
	}

	return res;
}

std::string VisionModule::encodeImageToBase64(const std::string &imagePath) const {
	if (isPdfFile(imagePath)) {
		LOG_WARN("vision", "PDF input is not supported for image encoding: " + imagePath);
		return "";
	}

	// Acquire semaphore to limit concurrent memory-intensive image loading
	processingSemaphore_.acquire();
	// Use scope exit or manual release to ensure semaphore is released
	struct SemaphoreGuard {
		std::counting_semaphore<4> &sem;
		~SemaphoreGuard() {
			sem.release();
		}
	} guard{processingSemaphore_};

	int w, h, channels;
	// Use stbi_info to check dimensions before loading full pixels
	if (!stbi_info(imagePath.c_str(), &w, &h, &channels)) {
		LOG_ERROR("vision", "Failed to read image info: " + imagePath);
		return "";
	}

	if (w > 4096 || h > 4096) {
		LOG_ERROR("vision", "Image resolution too high (max 4096): " + std::to_string(w) + "x" + std::to_string(h));
		return "";
	}

	unsigned char *raw_data = stbi_load(imagePath.c_str(), &w, &h, &channels, 4);
	if (!raw_data) {
		LOG_ERROR("vision", "stb_image failed to load: " + imagePath);
		return "";
	}

	constexpr size_t kMaxOcrUploadBytes = 1024 * 1024;
	size_t           sourceSize         = 0;
	try {
		sourceSize = std::filesystem::file_size(imagePath);
	} catch (...) {
		// ignore file size lookup failures
	}

	std::unique_ptr<unsigned char, decltype(&stbi_image_free)> scopedData(raw_data, stbi_image_free);
	unsigned char                                             *processData = scopedData.get();

	int                        newW = w, newH = h;
	std::vector<unsigned char> resizedData;
	std::vector<unsigned char> jpegBuffer;
	try {
		if (w > 1024 || h > 1024) {
			float scale = 1024.0f / static_cast<float>(std::max(w, h));
			newW        = static_cast<int>(w * scale);
			newH        = static_cast<int>(h * scale);

			resizedData.resize(newW * newH * 4);
			if (!stbir_resize_uint8_linear(processData, w, h, 0, resizedData.data(), newW, newH, 0, STBIR_RGBA)) {
				LOG_ERROR("vision", "Failed to resize image before OCR upload: " + imagePath);
				return "";
			}
			processData = resizedData.data();
		}

		if (sourceSize > kMaxOcrUploadBytes) {
			LOG_INFO("vision", "Input image larger than 1MB, applying OCR compression: " + imagePath);
		}

		int quality = sourceSize > kMaxOcrUploadBytes ? 70 : 80;
		for (int attempt = 0; attempt < 8; ++attempt) {
			jpegBuffer.clear();
			stbi_write_jpg_to_func(stbiWriteCallback, &jpegBuffer, newW, newH, 4, processData, quality);

			if (jpegBuffer.empty()) {
				LOG_ERROR("vision", "JPEG encoding failed for: " + imagePath);
				return "";
			}

			if (jpegBuffer.size() <= kMaxOcrUploadBytes) { return base64Encode(jpegBuffer.data(), jpegBuffer.size()); }

			if (newW <= 256 && newH <= 256 && quality <= 40) { break; }

			quality   = std::max(40, quality - 10);
			int nextW = std::max(1, static_cast<int>(newW * 0.85f));
			int nextH = std::max(1, static_cast<int>(newH * 0.85f));
			if (nextW == newW && nextH == newH) { break; }

			std::vector<unsigned char> nextResizedData(nextW * nextH * 4);
			if (!stbir_resize_uint8_linear(processData, newW, newH, 0, nextResizedData.data(), nextW, nextH, 0, STBIR_RGBA)) {
				LOG_ERROR("vision", "Failed to downscale image during OCR compression: " + imagePath);
				return "";
			}
			resizedData = std::move(nextResizedData);
			processData = resizedData.data();
			newW        = nextW;
			newH        = nextH;
		}

		LOG_ERROR("vision", "Failed to compress image under 1MB for OCR: " + imagePath);
		return "";
	} catch (const std::exception &e) {
		LOG_ERROR("vision", std::string("Exception during image encoding: ") + e.what());
		return "";
	}
}

} // namespace quickmemes
