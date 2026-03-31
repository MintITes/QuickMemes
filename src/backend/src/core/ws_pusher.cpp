/**
 * @file ws_pusher.cpp
 * @brief WebSocket 推送管理器占位实现
 */

#include "core/ws_pusher.hpp"

#include "utils/logger.hpp"

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <unordered_map>
#include <utility>
#include <vector>

// Callback interface passed from Websocket session to decouple the specific Beast types
namespace quickmemes {

class WsPusherImpl {
public:
	std::mutex                                                              mtx;
	std::unordered_map<uint64_t, WsSendCallback>                            session_map;
	std::atomic<std::shared_ptr<const std::vector<WsSendCallback>>>          sessions_rcu;
	std::atomic<std::shared_ptr<const std::function<void(const WsEvent &)>>> test_listener_rcu;
	uint64_t                                                                nextSessionId = 1;

	WsPusherImpl()
	    : sessions_rcu(std::make_shared<const std::vector<WsSendCallback>>()) {}
};

WsPusher::WsPusher()
    : impl_(new WsPusherImpl()) {}
WsPusher::~WsPusher() {
	delete static_cast<WsPusherImpl *>(impl_);
}

WsPusher &WsPusher::get() {
	static WsPusher instance;
	return instance;
}

void WsPusher::broadcast(const WsEvent &event) {
	auto impl = static_cast<WsPusherImpl *>(impl_);

	nlohmann::json payload;
	payload["event"] = event.event;
	payload["data"]  = event.payload;

	auto msg = std::make_shared<std::string>(payload.dump());

	// O(1) 无锁原子加载当前会话列表和监听器引用 (C++20 std::atomic<shared_ptr>)
	auto current_sessions = impl->sessions_rcu.load(std::memory_order_acquire);
	auto test_listener    = impl->test_listener_rcu.load(std::memory_order_acquire);

	if (test_listener && *test_listener) { (*test_listener)(event); }

	if (current_sessions) {
		// RCU: 在快照上安全遍历，无需加锁，性能最优且 CPU 缓存友好
		for (const auto &callback : *current_sessions) {
			if (callback) { callback(msg); }
		}
	}
}

void WsPusher::setTestListener(std::function<void(const WsEvent &)> cb) {
	auto impl = static_cast<WsPusherImpl *>(impl_);
	if (cb) {
		auto shared_cb = std::make_shared<const std::function<void(const WsEvent &)>>(std::move(cb));
		impl->test_listener_rcu.store(shared_cb, std::memory_order_release);
	} else {
		impl->test_listener_rcu.store(nullptr, std::memory_order_release);
	}
}

WsPusher::Registration WsPusher::addSession(WsSendCallback callback) {
	auto     impl = static_cast<WsPusherImpl *>(impl_);
	uint64_t sessionId;
	size_t   total_sessions;

	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		sessionId = impl->nextSessionId++;
		impl->session_map.emplace(sessionId, std::move(callback));
		total_sessions = impl->session_map.size();

		// RCU 写路径: Copy-on-Write 构建新的连续 vector 并原子更新
		auto new_vec = std::make_shared<std::vector<WsSendCallback>>();
		new_vec->reserve(total_sessions);
		for (const auto &[id, cb] : impl->session_map) {
			new_vec->push_back(cb);
		}
		impl->sessions_rcu.store(new_vec, std::memory_order_release);
	}

	LOG_INFO("ws", "Session added to WsPusher. Total: " + std::to_string(total_sessions));
	return Registration(new WsSessionRegistration(this, sessionId));
}

void WsPusher::removeSession(uint64_t sessionId) {
	auto   impl = static_cast<WsPusherImpl *>(impl_);
	size_t total_sessions;

	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		impl->session_map.erase(sessionId);
		total_sessions = impl->session_map.size();

		// RCU 写路径: Copy-on-Write 更新会话快照
		auto new_vec = std::make_shared<std::vector<WsSendCallback>>();
		new_vec->reserve(total_sessions);
		for (const auto &[id, cb] : impl->session_map) {
			new_vec->push_back(cb);
		}
		impl->sessions_rcu.store(new_vec, std::memory_order_release);
	}

	LOG_INFO("ws", "Session removed from WsPusher. Total: " + std::to_string(total_sessions));
}

void WsPusher::clearSessions() {
	auto impl = static_cast<WsPusherImpl *>(impl_);
	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		impl->session_map.clear();
		impl->sessions_rcu.store(std::make_shared<const std::vector<WsSendCallback>>(), std::memory_order_release);
	}
	LOG_INFO("ws", "All sessions removed from WsPusher.");
}

WsSessionRegistration::WsSessionRegistration(WsPusher *owner, uint64_t sessionId)
    : owner_(owner)
    , sessionId_(sessionId) {}

WsSessionRegistration::~WsSessionRegistration() {
	reset();
}

void WsSessionRegistration::reset() {
	if (owner_ == nullptr) { return; }
	owner_->removeSession(sessionId_);
	owner_     = nullptr;
	sessionId_ = 0;
}

} // namespace quickmemes
