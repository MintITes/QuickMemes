/**
 * @file ws_pusher.cpp
 * @brief WebSocket 推送管理器占位实现
 */

#include "core/ws_pusher.hpp"
#include "utils/logger.hpp"

namespace quickmemes {

WsPusher::WsPusher() : impl_(nullptr) {}
WsPusher::~WsPusher() = default;

WsPusher& WsPusher::get() {
    static WsPusher instance;
    return instance;
}

void WsPusher::broadcast(const WsEvent& event) {
    // TODO: implement — 遍历所有 Session，序列化 JSON 发送 text 帧
    (void)event;
    LOG_DEBUG("ws", "WsPusher::broadcast() — TODO: implement");
}

void WsPusher::addSession(void* sessionPtr) {
    (void)sessionPtr;
    // TODO: implement — 加入活跃集合
}

void WsPusher::removeSession(void* sessionPtr) {
    (void)sessionPtr;
    // TODO: implement — 从集合移除
}

}  // namespace quickmemes
