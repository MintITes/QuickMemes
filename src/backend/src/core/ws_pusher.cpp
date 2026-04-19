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
#include <ranges>
#include <unordered_map>
#include <utility>
#include <vector>

// ---------------------------------------------------------------------------
// AtomicSharedPtr<T>: 跨编译器的原子 shared_ptr 包装
//
//  • 非 Apple 平台（GCC / MSVC）：直接使用 C++20 std::atomic<shared_ptr<T>> 特化，
//    标准库已提供正确的无锁或内部锁实现。
//  • Apple Clang / libc++：其通用 atomic<T> 实现路径要求 T trivially copyable，
//    shared_ptr 不满足（编译报错）；改用 C++11 std::atomic_load/store_explicit
//    自由函数，语义完全等价且所有版本均支持。
// ---------------------------------------------------------------------------
#if defined(__APPLE__)
template <typename T>
class AtomicSharedPtr {
public:
    AtomicSharedPtr() = default;
    explicit AtomicSharedPtr(std::shared_ptr<T> p) : ptr_(std::move(p)) {}

    AtomicSharedPtr(const AtomicSharedPtr &) = delete;
    AtomicSharedPtr &operator=(const AtomicSharedPtr &) = delete;

    std::shared_ptr<T> load(std::memory_order order = std::memory_order_seq_cst) const {
        return std::atomic_load_explicit(&ptr_, order);
    }
    void store(std::shared_ptr<T> desired, std::memory_order order = std::memory_order_seq_cst) {
        std::atomic_store_explicit(&ptr_, std::move(desired), order);
    }

private:
    std::shared_ptr<T> ptr_;
};
#else
// GCC / MSVC: 直接复用标准 C++20 特化，接口完全一致
template <typename T>
using AtomicSharedPtr = std::atomic<std::shared_ptr<T>>;
#endif

// Callback interface passed from Websocket session to decouple the specific Beast types
namespace quickmemes {

class WsPusherImpl {
public:
	std::mutex                                                                       mtx;
	std::unordered_map<uint64_t, std::shared_ptr<WsSendCallback>>                    session_map;
	AtomicSharedPtr<const std::vector<std::shared_ptr<WsSendCallback>>>              sessions_rcu;
	AtomicSharedPtr<const std::function<void(const WsEvent &)>>                      test_listener_rcu;
	uint64_t                                                                         nextSessionId = 1;

	WsPusherImpl()
	    : sessions_rcu(std::make_shared<const std::vector<std::shared_ptr<WsSendCallback>>>()) {}
};

WsPusher::WsPusher()
    : impl_(new WsPusherImpl()) {}
WsPusher::~WsPusher() {
	delete static_cast<WsPusherImpl *>(impl_);
}

WsPusher &WsPusher::get() {
	// 故意泄漏单例，避免程序退出阶段由于静态变量销毁顺序导致的 Use-After-Free
	static WsPusher *instance = new WsPusher();
	return *instance;
}

void WsPusher::broadcast(const WsEvent &event) {
	auto impl = static_cast<WsPusherImpl *>(impl_);

	nlohmann::json payload = {
		{"event", event.event},
		{"data",  event.payload}
	};

	auto msg = std::make_shared<std::string>(payload.dump());

	// O(1) 无锁原子加载当前会话列表和监听器引用
	auto current_sessions = impl->sessions_rcu.load(std::memory_order_acquire);
	auto test_listener    = impl->test_listener_rcu.load(std::memory_order_acquire);

	if (test_listener && *test_listener) { (*test_listener)(event); }

	if (current_sessions) {
		// RCU: 在快照上安全遍历，无需加锁，性能最优且 CPU 缓存友好
		for (const auto &callback_ptr : *current_sessions) {
			if (callback_ptr && *callback_ptr) { (*callback_ptr)(msg); }
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
	size_t   current_size = 0;

	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		sessionId = impl->nextSessionId++;
		impl->session_map.emplace(sessionId, std::make_shared<WsSendCallback>(std::move(callback)));
		current_size = impl->session_map.size();

		// C++20 ranges: 一次性完成遍历与构建，避免手写循环，避免 std::function 拷贝分配
		auto values_view = impl->session_map | std::views::values;
		auto new_vec = std::make_shared<std::vector<std::shared_ptr<WsSendCallback>>>(
		    values_view.begin(), values_view.end()
		);
		impl->sessions_rcu.store(new_vec, std::memory_order_release);
	} // 锁已释放，安全地进行 I/O 与字符串拼接

	LOG_INFO("ws", "Session added to WsPusher. Total: " + std::to_string(current_size));
	return Registration(new WsSessionRegistration(this, sessionId));
}

void WsPusher::removeSession(uint64_t sessionId) {
	auto   impl = static_cast<WsPusherImpl *>(impl_);
	size_t current_size = 0;

	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		impl->session_map.erase(sessionId);
		current_size = impl->session_map.size();

		// C++20 ranges: 一次性完成遍历与构建
		auto values_view = impl->session_map | std::views::values;
		auto new_vec = std::make_shared<std::vector<std::shared_ptr<WsSendCallback>>>(
		    values_view.begin(), values_view.end()
		);
		impl->sessions_rcu.store(new_vec, std::memory_order_release);
	} // 锁释放，避免 I/O 阻塞核心全局锁

	LOG_INFO("ws", "Session removed from WsPusher. Total: " + std::to_string(current_size));
}

void WsPusher::clearSessions() {
	auto   impl = static_cast<WsPusherImpl *>(impl_);
	size_t cleared_count = 0;

	{
		std::lock_guard<std::mutex> lock(impl->mtx);
		cleared_count = impl->session_map.size();
		impl->session_map.clear();
		// 原子更新为空列表快照
		impl->sessions_rcu.store(
		    std::make_shared<const std::vector<std::shared_ptr<WsSendCallback>>>(),
		    std::memory_order_release
		);
	}

	LOG_INFO("ws", "All sessions removed from WsPusher. Count: " + std::to_string(cleared_count));
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
