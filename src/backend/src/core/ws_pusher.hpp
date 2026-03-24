#pragma once
/**
 * @file ws_pusher.hpp
 * @brief WebSocket 事件推送管理器
 *
 * 管理所有活跃的 WebSocket 会话，并向前端广播或单播事件。
 */

#include "api_types.hpp"

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace quickmemes {

using WsSendCallback = std::function<void(std::shared_ptr<std::string>)>;

class WsPusherImpl;
class WsSessionRegistration;

/**
 * @brief WebSocket 推送单例
 */
class WsPusher {
public:
	using Registration = std::shared_ptr<WsSessionRegistration>;

	static WsPusher &get();

	/**
	 * @brief 广播事件给所有已连接客户端
	 *
	 * @param event WsEvent 包含名称和 JSON 负载的事件
	 */
	void broadcast(const WsEvent &event);

	/**
	 * @brief [INTERNAL] 为测试准备的事件回调
	 * @param cb 回调函数
	 */
	void setTestListener(std::function<void(const WsEvent &)> cb);

	/**
	 * @brief 注册会话发送回调，并返回可自动退订的句柄
	 */
	[[nodiscard]] Registration addSession(WsSendCallback callback);

	/**
	 * @brief 清空所有已注册的会话
	 */
	void clearSessions();

	// 禁止拷贝和移动
	WsPusher(const WsPusher &)            = delete;
	WsPusher &operator=(const WsPusher &) = delete;

private:
	WsPusher();
	~WsPusher();

	friend class WsSessionRegistration;
	void removeSession(uint64_t sessionId);

	void *impl_; ///< 隐藏连接集合细节
};

class WsSessionRegistration {
public:
	~WsSessionRegistration();

	void reset();

	WsSessionRegistration(const WsSessionRegistration &)            = delete;
	WsSessionRegistration &operator=(const WsSessionRegistration &) = delete;

private:
	friend class WsPusher;

	WsSessionRegistration(WsPusher *owner, uint64_t sessionId);

	WsPusher *owner_;
	uint64_t  sessionId_;
};

} // namespace quickmemes
