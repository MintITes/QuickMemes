#pragma once
/**
 * @file ws_pusher.hpp
 * @brief WebSocket 事件推送管理器
 *
 * 管理所有活跃的 WebSocket 会话，并向前端广播或单播事件。
 */

#include "api_types.hpp"
#include <string>

namespace quickmemes {

class WsPusherImpl;

/**
 * @brief WebSocket 推送单例
 */
class WsPusher {
public:
    static WsPusher& get();

    /**
     * @brief 广播事件给所有已连接客户端
     *
     * @param event WsEvent 包含名称和 JSON 负载的事件
     */
    void broadcast(const WsEvent& event);

    /**
     * @brief 将连接描述符注册到管理器
     * @param sessionPtr void* 底层 WebSocket Session 指针
     */
    void addSession(void* sessionPtr);

    /**
     * @brief 从管理器移除闭合的连接
     * @param sessionPtr void* 底层 WebSocket Session 指针
     */
    void removeSession(void* sessionPtr);

    // 禁止拷贝和移动
    WsPusher(const WsPusher&) = delete;
    WsPusher& operator=(const WsPusher&) = delete;

private:
    WsPusher();
    ~WsPusher();

    void* impl_;  ///< 隐藏连接集合细节
};

}  // namespace quickmemes
