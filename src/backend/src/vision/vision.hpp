#pragma once
/**
 * @file vision.hpp
 * @brief Vision 模块接口声明
 *
 * 严格对应 docs/arch/vision.md 全部函数规范。
 * 处理本地/云端 OCR 和 VLM 图像分析、Embedding 生成。
 */

#include "types.hpp"
#include "utils/config_parser.hpp"
#include "vision/http_client.hpp"

#include <memory>
#include <semaphore>
#include <string>

namespace quickmemes {

/**
 * @brief Vision 视觉能力模块
 *
 * 封装与大语言视觉模型 (VLM) 及云端/本地 OCR 引擎的交互。
 */
class VisionModule {
public:
	static VisionModule &get() {
		static VisionModule instance;
		return instance;
	}

	/**
	 * @brief 构造函数
	 *
	 * 支持注入自定义 HttpClient 后端（默认为生产环境版本 HttpClient）。
	 *
	 * @param httpClient std::shared_ptr<HttpClientInterface> HTTP 通信接口实例
	 */
	explicit VisionModule(std::shared_ptr<HttpClientInterface> httpClient = std::make_shared<HttpClient>());
	~VisionModule();

	/**
	 * @brief 初始化模块
	 *
	 * 解析配置并在具备可用凭据时探测 API 连通性。
	 *
	 * @param config VisionConfig 视觉模块配置参数
	 * @return bool 若至少一种能力 (AI/OCR) 可用返回 true，全部不可用返回 false
	 */
	bool initialize(const VisionConfig &config);

	/**
	 * @brief 关闭模块
	 *
	 * 执行当前飞行请求取消等清理工作。
	 */
	void shutdown();

	/**
	 * @brief 热重载配置
	 *
	 * 更新鉴权密钥或模型名称（无须重启进程）。
	 *
	 * @param newConfig VisionConfig 新的配置对象
	 * @return bool 重载成功返回 true
	 */
	bool reconfigure(const VisionConfig &newConfig);

	/**
	 * @brief 设置自定义 HttpClient（主要用于测试注入）
	 */
	void setHttpClient(std::shared_ptr<HttpClientInterface> client) {
		httpClient_ = std::move(client);
	}

	/**
	 * @brief 检查大模型能力是否可用
	 * @return bool 已配置且服务连通性正常返回 true
	 */
	[[nodiscard]] bool isAvailable() const;

	/**
	 * @brief 检查 OCR 能力是否可用
	 * @return bool 已配置且服务连通性正常返回 true
	 */
	[[nodiscard]] bool isOcrAvailable() const;

	/**
	 * @brief 获取探测到的向量维度
	 * @return int 维度大小，若未探测到返回 0
	 */
	[[nodiscard]] int getEmbeddingDimension() const {
		return embeddingDim_;
	}

	/**
	 * @brief 执行文本识别 (OCR)
	 *
	 * 根据配置调用云端 OCR API。
	 *
	 * @param imagePath std::string 目标图像或缩略图绝对路径
	 * @return OcrResult 包含全文及成功标识
	 * @throws ApiException 内部重试耗尽或其他不可恢复错误时抛出
	 */
	OcrResult recognize(const std::string &imagePath);

	/**
	 * @brief 执行图像语义分析与标签提取
	 *
	 * 将图像结合 system prompt 请求 VLM 分析，期待返回特定 JSON 结构。
	 * 分析文本包含生成的描述及一组推荐标签。
	 *
	 * @param imagePath std::string 目标图像绝对路径
	 * @param ocrFullText std::string 前置 OCR 提取的文本（作为大模型参考），可为空
	 * @return AiAnalysisResult 包含生成描述和标签列表
	 */
	AiAnalysisResult analyzeImage(const std::string &imagePath, const std::string &ocrFullText);

	/**
	 * @brief 将文本转换为语义向量
	 *
	 * 调用 Embedding API（如 text-embedding-3-small）生成特征向量。
	 *
	 * @param text std::string 待转换的拼接文本（含标签、描述、OCR）
	 * @return std::vector<float> 归一化语义向量序列
	 */
	std::vector<float> generateEmbedding(const std::string &text);

private:
	/**
	 * @brief 将图像文件转换为 Base64 编码的 JPEG 并压缩体积
	 * @param imagePath std::string 文件路径
	 * @return std::string Base64 编码字符串
	 */
	std::string encodeImageToBase64(const std::string &imagePath) const;

	VisionConfig                         config_;                 ///< 当前运行时配置
	std::shared_ptr<HttpClientInterface> httpClient_;             ///< HTTP 客户端抽象接口
	bool                                 isAiAvailable_  = false; ///< AI 连通性状态标记
	bool                                 isOcrAvailable_ = false; ///< OCR 连通性状态标记
	int                                  embeddingDim_   = 0;     ///< 探测到的 embedding 向量维度

	// Limit concurrent image processing to prevent OOM
	mutable std::counting_semaphore<4> processingSemaphore_{4};
};

} // namespace quickmemes
