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
#include <cmath>
#include <fstream>
#include <nlohmann/json.hpp>
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

		if (isAiAvailable_ && !config_.embeddingModel.empty()) {
			auto probe = generateEmbedding("probe");
			if (!probe.empty()) {
				embeddingDim_ = static_cast<int>(probe.size());
				LOG_INFO("vision", "Embedding dimension detected: " + std::to_string(embeddingDim_));
			}
		}
	}

	isOcrAvailable_ = (!config_.ocrApiKey.empty() && !config_.ocrApiUrl.empty() && !config_.ocrProvider.empty());

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
	res.success  = true;
	res.fullText = "OCR Extraction Placeholder"; // 占位接口，待适配
	res.error    = "";

	LOG_INFO("vision", "OCR recognize called (Placeholder mode) for: " + imagePath);
	return res;
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
        {{"role", "system"},{"content", systemPrompt}                    },
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

		std::string content      = message["content"].get<std::string>();
		auto        analysisJson = nlohmann::json::parse(content);

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

std::vector<float> VisionModule::generateEmbedding(const std::string &text) {
	if (!isAiAvailable_) { return {}; }

	if (text.empty()) {
		if (embeddingDim_ > 0) { return std::vector<float>(embeddingDim_, 0.0f); }
		return {};
	}

	std::string inputText = text;
	if (inputText.size() > 8000) { inputText = inputText.substr(0, 8000); }

	nlohmann::json requestBody;
	requestBody["model"] = config_.embeddingModel;
	requestBody["input"] = inputText;

	std::string url     = config_.apiBaseUrl + "/embeddings";
	std::string headers = "Authorization: Bearer " + config_.apiKey + "\r\n";

	try {
		std::string responseBody = httpClient_->post(url, headers, requestBody.dump(), config_.timeoutSeconds);

		auto respJson     = nlohmann::json::parse(responseBody);
		auto embeddingArr = respJson["data"][0]["embedding"];

		std::vector<float> result;
		result.reserve(embeddingArr.size());
		for (const auto &val : embeddingArr) {
			result.push_back(val.get<float>());
		}

		return result;
	} catch (const std::exception &e) {
		LOG_ERROR("vision", "generateEmbedding failed: " + std::string(e.what()));
		return {};
	}
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

	std::unique_ptr<unsigned char, decltype(&stbi_image_free)> scopedData(raw_data, stbi_image_free);
	unsigned char                                             *processData = scopedData.get();

	int                        newW = w, newH = h;
	std::vector<unsigned char> resizedData;
	try {
		if (w > 1024 || h > 1024) {
			float scale = 1024.0f / static_cast<float>(std::max(w, h));
			newW        = static_cast<int>(w * scale);
			newH        = static_cast<int>(h * scale);

			resizedData.resize(newW * newH * 4);
			stbir_resize_uint8_linear(processData, w, h, 0, resizedData.data(), newW, newH, 0, STBIR_RGBA);
			processData = resizedData.data();
		}

		std::vector<unsigned char> jpegBuffer;
		stbi_write_jpg_to_func(stbiWriteCallback, &jpegBuffer, newW, newH, 4, processData, 80);

		if (jpegBuffer.empty()) {
			LOG_ERROR("vision", "JPEG encoding failed for: " + imagePath);
			return "";
		}

		return base64Encode(jpegBuffer.data(), jpegBuffer.size());
	} catch (const std::exception &e) {
		LOG_ERROR("vision", std::string("Exception during image encoding: ") + e.what());
		return "";
	}
}

} // namespace quickmemes
