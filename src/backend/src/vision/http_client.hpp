#pragma once
/**
 * @file http_client.hpp
 * @brief HTTP 客户端接口声明
 *
 * 包装 Boost.Beast 用于发送外部 HTTPS 请求（供 Vision 模块调用云端 API）。
 * 提取为纯虚接口以便在 GTest 中通过 Mock 类模拟网络响应。
 */

#include <string>

namespace quickmemes {

/**
 * @brief HTTP 客户端纯虚接口
 *
 * 供 Vision 模块通过依赖注入使用，解耦实际的网络 I/O。
 */
class HttpClientInterface {
public:
    virtual ~HttpClientInterface() = default;

    /**
     * @brief 发送 HTTP POST 请求
     *
     * @param url std::string 完整的请求 URL（如 "https://api.openai.com/v1/chat/completions"）
     * @param headers std::string 额外请求头（格式 "Key: Value\r\n"），内部自动处理 Host/Content-Length 等
     * @param body std::string 请求体数据（如 JSON 序列化字符串）
     * @param timeoutSeconds int 请求超时时间（秒）
     * @return std::string 服务端返回的响应体
     * @throws ApiException(ERR_AI_REQUEST_FAILED) 网络错误、超时或 HTTP 状态码非 2xx 时
     */
    virtual std::string post(const std::string& url,
                             const std::string& headers,
                             const std::string& body,
                             int timeoutSeconds) = 0;
};

/**
 * @brief 生产环境 HTTP 客户端实现
 *
 * 使用 Boost.Beast 和 OpenSSL 实现同步或协程 HTTPS 请求。
 */
class HttpClient : public HttpClientInterface {
public:
    HttpClient() = default;
    ~HttpClient() override = default;

    /**
     * @brief 发送 HTTP POST 请求实现
     * @param url std::string 完整的请求 URL
     * @param headers std::string 额外请求头（换行符分隔）
     * @param body std::string 请求体数据
     * @param timeoutSeconds int 请求超时时间（秒）
     * @return std::string 响应体
     * @throws ApiException
     */
    std::string post(const std::string& url,
                     const std::string& headers,
                     const std::string& body,
                     int timeoutSeconds) override;
};

}  // namespace quickmemes
