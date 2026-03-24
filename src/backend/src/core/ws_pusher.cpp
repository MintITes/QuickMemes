/**
 * @file ws_pusher.cpp
 * @brief WebSocket 推送管理器占位实现
 */

#include "core/ws_pusher.hpp"

#include "utils/logger.hpp"

#include <cstdint>
#include <functional>
#include <mutex>
#include <nlohmann/json.hpp>
#include <unordered_map>
#include <utility>
#include <vector>

// Callback interface passed from Websocket session to decouple the specific Beast types
namespace quickmemes {

class WsPusherImpl {
public:
	std::mutex                           mtx;
	std::unordered_map<uint64_t, WsSendCallback> sessions;
	std::function<void(const WsEvent &)> testListener;
	uint64_t                             nextSessionId = 1;
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

	auto                                   msg = std::make_shared<std::string>(payload.dump());
	std::vector<WsSendCallback>            callbacks;
	std::function<void(const WsEvent &)>   testListener;

	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		callbacks.reserve(impl->sessions.size());
		for (const auto &[sessionId, callback] : impl->sessions) {
			(void)sessionId;
			callbacks.push_back(callback);
		}
		testListener = impl->testListener;
	}

	if (testListener) { testListener(event); }
	for (auto &callback : callbacks) {
		if (callback) { callback(msg); }
	}
}

void WsPusher::setTestListener(std::function<void(const WsEvent &)> cb) {
	auto                        impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);
	impl->testListener = std::move(cb);
}

WsPusher::Registration WsPusher::addSession(WsSendCallback callback) {
	auto                        impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);

	const uint64_t sessionId = impl->nextSessionId++;
	impl->sessions.emplace(sessionId, std::move(callback));
	LOG_INFO("ws", "Session added to WsPusher. Total: " + std::to_string(impl->sessions.size()));
	return Registration(new WsSessionRegistration(this, sessionId));
}

void WsPusher::removeSession(uint64_t sessionId) {
	auto                        impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);
	impl->sessions.erase(sessionId);
	LOG_INFO("ws", "Session removed from WsPusher. Total: " + std::to_string(impl->sessions.size()));
}

void WsPusher::clearSessions() {
	auto                        impl = static_cast<WsPusherImpl *>(impl_);
	std::lock_guard<std::mutex> lock(impl->mtx);
	impl->sessions.clear();
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
