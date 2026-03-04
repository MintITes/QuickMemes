#pragma once
/**
 * @file router.hpp
 * @brief 路由分发映射
 *
 * 注册所有前端请求的 API 路径至对应的 handlers。
 */

#include <functional>
#include <memory>
#include <string>

namespace quickmemes {

// 前向声明 Boost.Beast HttpRequest / HttpResponse 抽象类型
struct HttpRequestProxy;
struct HttpResponseProxy;

/**
 * @brief 路由处理函数签名
 */
using RouteHandler = std::function<void(const HttpRequestProxy&, HttpResponseProxy&)>;

/**
 * @brief 路由器管理器
 */
class Router {
public:
    Router();
    ~Router();

    /**
     * @brief 注册路由处理函数
     * @param method std::string HTTP 方法（"GET", "POST", "PUT", "DELETE"）
     * @param path std::string 仅匹配路径（如 "/api/memes"）
     * @param handler RouteHandler 处理函数
     */
    void registerRoute(const std::string& method, const std::string& path, RouteHandler handler);

    /**
     * @brief 分发 HTTP 请求
     *
     * @param req HttpRequestProxy 请求包装
     * @param res HttpResponseProxy 响应包装
     */
    void dispatch(const HttpRequestProxy& req, HttpResponseProxy& res);

    /**
     * @brief 验证全局认证 Token (静态工具方法)
     * @param token std::string 请求头传递的 Token
     * @param expected std::string 期望的合法 Token
     * @return bool 校验通过返回 true
     */
    static bool verifyAuthToken(const std::string& token, const std::string& expected);
};

}  // namespace quickmemes
