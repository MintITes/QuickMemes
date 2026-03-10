/**
 * @file ws_pusher.cpp
 * @brief WebSocket 推送管理器占位实现
 */

#include "core/ws_pusher.hpp"

#include "utils/logger.hpp"

#include <functional>
#include <mutex>
#include <nlohmann/json.hpp>
#include <unordered_set>

// Callback interface passed from Websocket session to decouple the specific Beast types
namespace quickmemes {

class WsPusherImpl {
public:
	std::mutex mtx;
	std::unordered_set<WsSendCallback *> sessions;
	std::function<void(const WsEvent &)> testListener;
};

WsPusher::WsPusher() : impl_(new WsPusherImpl()) {}
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

	std::lock_guard<std::mutex> lock(impl->mtx);
	if (impl->testListener) {
		impl->testListener(event);
	}
	for (auto *cb : impl->sessions) {
		if (cb && *cb) {
			(*cb)(msg);
		}
	}
}

void WsPusher::setTestListener(std::function<void(const WsEvent &)> cb) {
	auto impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);
	impl->testListener = std::move(cb);
}

void WsPusher::addSession(void *sessionPtr) {
	auto impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);
	impl->sessions.insert(static_cast<WsSendCallback *>(sessionPtr));
	LOG_INFO("ws", "Session added to WsPusher. Total: " + std::to_string(impl->sessions.size()));
}

void WsPusher::removeSession(void *sessionPtr) {
	auto impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);
	impl->sessions.erase(static_cast<WsSendCallback *>(sessionPtr));
	LOG_INFO("ws", "Session removed from WsPusher. Total: " + std::to_string(impl->sessions.size()));
}

} // namespace quickmemes
