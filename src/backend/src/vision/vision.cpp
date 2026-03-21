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
#include <nlohmann/json.hpp>
#include <sstream>
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
	result.reserve(((len + 2) / 3) * 4);

	for (size_t i = 0; i < len; i += 3) {
		unsigned int triple = (data[i] << 16);
		if (i + 1 < len) triple |= (data[i + 1] << 8);
		if (i + 2 < len) triple |= data[i + 2];

		result += base64Chars[(triple >> 18) & 0x3F];
		result += base64Chars[(triple >> 12) & 0x3F];
		result += (i + 1 < len) ? base64Chars[(triple >> 6) & 0x3F] : '=';
		result += (i + 2 < len) ? base64Chars[triple & 0x3F] : '=';
	}
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

static std::string trimCopy(std::string value) {
	auto ltrim = [](std::string &s) {
		s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](unsigned char c) { return !std::isspace(c); }));
	};
	auto rtrim = [](std::string &s) {
		s.erase(std::find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !std::isspace(c); }).base(), s.end());
	};
	ltrim(value);
	rtrim(value);
	return value;
}

static bool isGifImage(const std::string &imagePath) {
	auto ext = toLowerCopy(std::filesystem::path(imagePath).extension().string());
	return ext == ".gif";
}

static bool isPdfFile(const std::string &imagePath) {
	auto ext = toLowerCopy(std::filesystem::path(imagePath).extension().string());
	return ext == ".pdf";
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
	std::ostringstream encoded;
	encoded << std::uppercase << std::hex;
	for (unsigned char c : value) {
		if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' ||
		    c == '.' || c == '~') {
			encoded << static_cast<char>(c);
		} else if (c == ' ') {
			encoded << '+';
		} else {
			encoded << '%' << std::setw(2) << std::setfill('0') << static_cast<int>(c);
		}
	}
	return encoded.str();
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
	std::ostringstream body;
	body << "base64Image=" << urlEncode("data:image/jpeg;base64," + base64Image) << '&';
	body << "language=" << urlEncode("chs") << '&';
	body << "isOverlayRequired=" << urlEncode("false") << '&';
	body << "detectOrientation=" << urlEncode("true") << '&';
	body << "scale=" << urlEncode("true") << '&';
	body << "OCREngine=" << urlEncode("2");
	return body.str();
}

static std::string buildOcrSpaceHeaders(const std::string &apiKey) {
	return "apikey: " + apiKey + "\r\nContent-Type: application/x-www-form-urlencoded\r\n";
}

static std::string buildPaddleOcrRequestBody(const std::string &base64Image, const std::string &imagePath) {
	nlohmann::json body;
	body["file"]                      = base64Image;
	body["fileType"]                  = isPdfFile(imagePath) ? 0 : 1;
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
    : httpClient_(std::move(httpClient)) {}

VisionModule::~VisionModule() = default;

bool VisionModule::initialize(const VisionConfig &config) {
	config_ = config;

	isAiAvailable_ = false;
	if (!config_.apiKey.empty() && !config_.apiBaseUrl.empty()) {
		try {
			std::string probeUrl   = config_.apiBaseUrl + "/models";
			std::string authHeader = "Authorization: Bearer " + config_.apiKey + "\r\n";
			httpClient_->get(probeUrl, authHeader, config_.timeoutSeconds);
			isAiAvailable_ = true;
			LOG_INFO("vision", "AI service probe succeeded.");
		} catch (const std::exception &e) {
			LOG_WARN("vision", std::string("AI service probe failed: ") + e.what());
			isAiAvailable_ = false;
		}

	}

	isOcrAvailable_ = (!config_.ocrApiKey.empty() && !config_.ocrApiUrl.empty() &&
	                   (isPaddleOcrProvider(config_.ocrProvider) || isOcrSpaceProvider(config_.ocrProvider)));
	if (!config_.ocrProvider.empty() && !isPaddleOcrProvider(config_.ocrProvider) &&
	    !isOcrSpaceProvider(config_.ocrProvider)) {
		LOG_WARN("vision",
		         "Unsupported OCR provider: " + config_.ocrProvider + ". Only PaddleOCR / OcrSpace are enabled.");
	}

	LOG_INFO("vision",
	         "VisionModule initialized — AI: " + std::string(isAiAvailable_ ? "available" : "unavailable") +
	             ", OCR: " + std::string(isOcrAvailable_ ? "available" : "unavailable"));

	return isAiAvailable_ || isOcrAvailable_;
}

void VisionModule::shutdown() {
	isAiAvailable_  = false;
	isOcrAvailable_ = false;
	LOG_INFO("vision", "VisionModule shutdown.");
}

bool VisionModule::reconfigure(const VisionConfig &newConfig) {
	config_ = newConfig;
	return initialize(config_);
}

bool VisionModule::isAvailable() const {
	return isAiAvailable_;
}

bool VisionModule::isOcrAvailable() const {
	return isOcrAvailable_;
}

OcrResult VisionModule::recognize(const std::string &imagePath) {
	OcrResult res;
	if (!isPaddleOcrProvider(config_.ocrProvider) && !isOcrSpaceProvider(config_.ocrProvider)) {
		res.success = false;
		res.error   = config_.ocrProvider.empty() ? "OCR provider not configured"
		                                          : "Unsupported OCR provider: " + config_.ocrProvider;
		LOG_WARN("vision", "OCR recognize skipped: " + res.error);
		return res;
	}

	if (!isOcrAvailable_) {
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
	if (isPaddleOcrProvider(config_.ocrProvider)) {
		url           = normalizePaddleOcrUrl(config_.ocrApiUrl);
		body          = buildPaddleOcrRequestBody(imageBase64, imagePath);
		headers       = buildPaddleOcrHeaders(config_.ocrApiKey);
		providerLabel = "PaddleOCR";
	} else {
		url           = normalizeOcrSpaceUrl(config_.ocrApiUrl);
		body          = buildOcrSpaceRequestBody(imageBase64);
		headers       = buildOcrSpaceHeaders(config_.ocrApiKey);
		providerLabel = "OcrSpace";
	}

	std::string responseBody;
	int         retries = config_.maxRetries;
	for (int attempt = 0; attempt <= retries; ++attempt) {
		try {
			responseBody = httpClient_->post(url, headers, body, config_.timeoutSeconds);
			break;
		} catch (const ApiException &e) {
			if (attempt == retries) {
				LOG_ERROR("vision", providerLabel + " request failed after retries: " + std::string(e.what()));
				res.success = false;
				res.error   = e.what();
				return res;
			}
			std::this_thread::sleep_for(std::chrono::milliseconds(500 * (1 << attempt)));
		}
	}

	try {
		if (isPaddleOcrProvider(config_.ocrProvider)) {
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

	if (!isAiAvailable_) {
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
	requestBody["model"]      = config_.visionModel;
	requestBody["messages"]   = nlohmann::json::array({
	    {{"role", "system"},{"content", systemPrompt}                      },
	    {  {"role", "user"},
	     {"content",
         nlohmann::json::array(
         {{{"type", "image_url"}, {"image_url", {{"url", "data:image/jpeg;base64," + imageBase64}}}},
         {{"type", "text"}, {"text", userText}}})}}
    });
	requestBody["max_tokens"] = 1000;

	std::string url     = config_.apiBaseUrl + "/chat/completions";
	std::string headers = "Authorization: Bearer " + config_.apiKey + "\r\n";

	std::string responseBody;
	int         retries = config_.maxRetries;
	for (int attempt = 0; attempt <= retries; ++attempt) {
		try {
			responseBody = httpClient_->post(url, headers, requestBody.dump(), config_.timeoutSeconds);
			break;
		} catch (const ApiException &e) {
			if (attempt == retries) {
				LOG_ERROR("vision", "analyzeImage failed after retries: " + std::string(e.what()));
				res.success = false;
				res.error   = e.what();
				return res;
			}
			std::this_thread::sleep_for(std::chrono::milliseconds(500 * (1 << attempt)));
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

		std::string content = message["content"].get<std::string>();

		// 修复问题4：清洗LLM可能返回的Markdown代码块包装（```json ... ```）
		// 去除首尾空白
		auto ltrim = [](std::string &s) {
			s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](unsigned char c) { return !std::isspace(c); }));
		};
		auto rtrim = [](std::string &s) {
			s.erase(std::find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !std::isspace(c); }).base(),
			        s.end());
		};
		ltrim(content);
		rtrim(content);
		// 去除 ```json 或 ``` 开头
		if (content.size() >= 7 && content.substr(0, 7) == "```json") {
			content = content.substr(7);
		} else if (content.size() >= 3 && content.substr(0, 3) == "```") {
			content = content.substr(3);
		}
		// 去除结尾的 ```
		if (content.size() >= 3 && content.substr(content.size() - 3) == "```") { content.resize(content.size() - 3); }
		ltrim(content);
		rtrim(content);

		auto analysisJson = nlohmann::json::parse(content);

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
			stbir_resize_uint8_linear(processData, w, h, 0, resizedData.data(), newW, newH, 0, STBIR_RGBA);
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

			resizedData.clear();
			resizedData.resize(nextW * nextH * 4);
			stbir_resize_uint8_linear(processData, newW, newH, 0, resizedData.data(), nextW, nextH, 0, STBIR_RGBA);
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
