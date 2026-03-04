/**
 * @file vision.cpp
 * @brief Vision 模块占位实现
 */

#include "vision/vision.hpp"
#include "utils/logger.hpp"
#include "error_codes.hpp"

namespace quickmemes {

VisionModule::VisionModule(std::shared_ptr<HttpClientInterface> httpClient)
    : httpClient_(std::move(httpClient)) {}

VisionModule::~VisionModule() = default;

bool VisionModule::initialize(const VisionConfig& config) {
    config_ = config;

    // TODO: implement — 发送探测请求测试连通性
    // 若配置为空，则设为不可用，不抛异常（系统允许在无 AI 环境下降级运行）

    if (!config_.apiKey.empty() && !config_.apiBaseUrl.empty()) {
        isAiAvailable_ = true; // 占位
    }
    if (!config_.ocrApiUrl.empty()) {
        isOcrAvailable_ = true; // 占位
    }

    LOG_INFO("vision", "VisionModule::initialize() — TODO: implement");
    return isAiAvailable_ || isOcrAvailable_;
}

void VisionModule::shutdown() {
    LOG_INFO("vision", "VisionModule::shutdown() — TODO: implement");
    isAiAvailable_  = false;
    isOcrAvailable_ = false;
}

bool VisionModule::reconfigure(const VisionConfig& newConfig) {
    config_ = newConfig;
    LOG_INFO("vision", "VisionModule::reconfigure() — TODO: implement");
    return initialize(config_);
}

bool VisionModule::isAvailable() const {
    return isAiAvailable_;
}

bool VisionModule::isOcrAvailable() const {
    return isOcrAvailable_;
}

OcrResult VisionModule::recognize(const std::string& imagePath) {
    // TODO: implement — 构造请求调用 OCR API
    (void)imagePath;
    LOG_INFO("vision", "VisionModule::recognize() — TODO: implement");

    OcrResult res;
    res.success = false;
    res.error = "Not implemented";
    return res;
}

AiAnalysisResult VisionModule::analyzeImage(const std::string& imagePath, const std::string& ocrFullText) {
    // TODO: implement — 构造 Prompt、Base64 编码图像，调用 VLM 并解析 JSON 结果
    (void)imagePath;
    (void)ocrFullText;
    LOG_INFO("vision", "VisionModule::analyzeImage() — TODO: implement");

    AiAnalysisResult res;
    res.success = false;
    res.error = "Not implemented";
    return res;
}

std::vector<float> VisionModule::generateEmbedding(const std::string& text) {
    // TODO: implement — 调用 Embeddings API
    (void)text;
    LOG_INFO("vision", "VisionModule::generateEmbedding() — TODO: implement");
    return {};
}

std::string VisionModule::encodeImageToBase64(const std::string& imagePath) const {
    // TODO: implement — stb 调整尺寸并 Base64 编码
    (void)imagePath;
    return "";
}

}  // namespace quickmemes
