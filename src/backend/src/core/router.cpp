/**
 * @file router.cpp
 * @brief 路由分发映射实现
 */

#include "core/router.hpp"
#include "utils/logger.hpp"

namespace quickmemes {

Router::Router() = default;
Router::~Router() = default;

void Router::registerRoute(const std::string& method, const std::string& path, RouteHandler handler) {
    // TODO: implement — 内部存储 route map
    (void)method;
    (void)path;
    (void)handler;
    LOG_INFO("router", "Router::registerRoute() — TODO: implement");
}

void Router::dispatch(const HttpRequestProxy& req, HttpResponseProxy& res) {
    // TODO: implement — 路径解析、Token 拦截、查找方法并调用对应 handler
    // 如果无对应路由，返回 404
    (void)req;
    (void)res;
    LOG_INFO("router", "Router::dispatch() — TODO: implement");
}

bool Router::verifyAuthToken(const std::string& token, const std::string& expected) {
    // 简单的字符串等值比较
    return token == expected;
}

}  // namespace quickmemes
