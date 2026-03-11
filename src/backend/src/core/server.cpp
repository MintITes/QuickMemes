#include "core/server.hpp"

#include "core/router.hpp"
#include "core/task_queue.hpp"
#include "core/ws_pusher.hpp"
#include "db/database.hpp"
#include "utils/logger.hpp"
#include "vision/vision.hpp"

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/signal_set.hpp>
#include <boost/asio/strand.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/websocket.hpp>
#include <filesystem>
#include <mutex>
#include <thread>
#include <vector>

namespace quickmemes {

namespace net = boost::asio;
using tcp     = boost::asio::ip::tcp;

namespace beast = boost::beast;
namespace http  = beast::http;

using WsSendCallback = std::function<void(std::shared_ptr<std::string>)>;

class WsSession : public std::enable_shared_from_this<WsSession> {
	beast::websocket::stream<beast::tcp_stream> ws_;
	beast::flat_buffer                          buffer_;
	WsSendCallback                              sendCb_;
	std::mutex                                  mtx_;
	std::vector<std::shared_ptr<std::string>>   sendQueue_;
	bool                                        isWriting_ = false;

public:
	explicit WsSession(beast::tcp_stream stream)
	    : ws_(std::move(stream)) {}

	template <class Body, class Allocator> void run(http::request<Body, http::basic_fields<Allocator>> req) {
		beast::websocket::stream_base::timeout opt{
		    std::chrono::seconds(30), // handshake_timeout
		    std::chrono::seconds(60), // idle_timeout
		    true                      // keep_alive_pings
		};
		ws_.set_option(opt);

		ws_.async_accept(req, beast::bind_front_handler(&WsSession::onAccept, shared_from_this()));
	}

	void onAccept(beast::error_code ec) {
		if (ec) return;

		sendCb_ = [self = shared_from_this()](std::shared_ptr<std::string> msg) {
			self->enqueueMsg(msg);
		};
		// Verification already happened in HttpSession::handleRequest before creating this session
		WsPusher::get().addSession(&sendCb_);

		doRead();
	}

	void doRead() {
		ws_.async_read(buffer_, beast::bind_front_handler(&WsSession::onRead, shared_from_this()));
	}

	void onRead(beast::error_code ec, std::size_t bytes_transferred) {
		boost::ignore_unused(bytes_transferred);
		if (ec == beast::websocket::error::closed) {
			WsPusher::get().removeSession(&sendCb_);
			return;
		}
		if (ec) {
			WsPusher::get().removeSession(&sendCb_);
			return;
		}

		auto msg = beast::buffers_to_string(buffer_.data());
		buffer_.consume(buffer_.size());
		doRead();
	}

	void enqueueMsg(std::shared_ptr<std::string> msg) {
		std::lock_guard<std::mutex> lock(mtx_);
		sendQueue_.push_back(msg);
		if (!isWriting_) {
			isWriting_ = true;
			doWrite();
		}
	}

	void doWrite() {
		std::shared_ptr<std::string> msg;
		{
			std::lock_guard<std::mutex> lock(mtx_);
			if (sendQueue_.empty()) {
				isWriting_ = false;
				return;
			}
			msg = sendQueue_.front();
			sendQueue_.erase(sendQueue_.begin());
		}

		ws_.text(true);
		ws_.async_write(net::buffer(*msg), beast::bind_front_handler(&WsSession::onWrite, shared_from_this()));
	}

	void onWrite(beast::error_code ec, std::size_t bytes_transferred) {
		boost::ignore_unused(bytes_transferred);
		if (ec) {
			WsPusher::get().removeSession(&sendCb_);
			return;
		}
		doWrite();
	}
};

class HttpSession : public std::enable_shared_from_this<HttpSession> {
public:
	HttpSession(tcp::socket &&socket, std::shared_ptr<Router> router)
	    : stream_(std::move(socket))
	    , router_(std::move(router)) {}

	void run() {
		doRead();
	}

private:
	beast::tcp_stream                stream_;
	beast::flat_buffer               buffer_;
	http::request<http::string_body> req_;
	std::shared_ptr<Router>          router_;

	void doRead() {
		req_ = {};

		stream_.expires_after(std::chrono::seconds(300));

		http::async_read(stream_, buffer_, req_, beast::bind_front_handler(&HttpSession::onRead, shared_from_this()));
	}

	void onRead(beast::error_code ec, std::size_t bytes_transferred) {
		boost::ignore_unused(bytes_transferred);

		if (ec == http::error::end_of_stream) {
			doClose();
			return;
		}
		if (ec) {
			LOG_ERROR("session", "Read error: " + ec.message());
			return;
		}

		handleRequest();
	}

	void handleRequest() {
		if (beast::websocket::is_upgrade(req_)) {
			auto        path          = std::string(req_.target());
			const bool       isWsPath      = path.rfind("/ws", 0) == 0; // strict path prefix check
			bool             authOk        = false;
			const std::string expectedToken = router_->getAuthToken();

			if (isWsPath) {
				if (expectedToken.empty()) {
					authOk = true; // WS auth disabled
				} else {
					size_t pos = path.find("?token=");
					if (pos == std::string::npos) { pos = path.find("&token="); }

					if (pos != std::string::npos) {
						std::string t         = path.substr(pos + 7);
						auto        ampersand = t.find('&');
						if (ampersand != std::string::npos) t.resize(ampersand);
						if (Router::verifyAuthToken(t, expectedToken)) { authOk = true; }
					}
				}
			}

			if (authOk) {
				auto session = std::make_shared<WsSession>(std::move(stream_));
				session->run(std::move(req_));
				return;
			} else {
				HttpResponseProxy resProxy;
				resProxy.status = isWsPath ? 401 : 404;
				resProxy.body   = isWsPath ?
				                   R"({"success": false, "data": null, "error": "Unauthorized WS", "code": 1001})" :
				                   R"({"success": false, "data": null, "error": "Not Found", "code": 1002})";
				auto res =
				    std::make_shared<http::response<http::string_body>>(static_cast<http::status>(resProxy.status),
				                                                        req_.version());
				res->set(http::field::server, "QuickMemes/1.0");
				res->set(http::field::content_type, "application/json");
				res->keep_alive(req_.keep_alive());
				res->body() = std::move(resProxy.body);
				res->prepare_payload();
				auto self = shared_from_this();
				http::async_write(stream_, *res, [self, res](beast::error_code ec, std::size_t /*b*/) {
					self->doClose();
				});
				return;
			}
		}

		HttpRequestProxy proxy;
		proxy.method = std::string(req_.method_string());
		proxy.path   = std::string(req_.target());
		proxy.body   = req_.body();

		auto authIt = req_.find(http::field::authorization);
		if (authIt != req_.end()) { proxy.header_auth = std::string(authIt->value()); }

		auto qpos = proxy.path.find('?');
		if (qpos != std::string::npos) {
			proxy.query = proxy.path.substr(qpos + 1);
			proxy.path  = proxy.path.substr(0, qpos);
		}

		HttpResponseProxy resProxy;
		router_->dispatch(proxy, resProxy);

		if (!resProxy.filePath.empty()) {
			beast::error_code           ev;
			http::file_body::value_type file;
			file.open(resProxy.filePath.c_str(), beast::file_mode::scan, ev);

			if (ev) {
				// File open failed, return 404
				auto res = std::make_shared<http::response<http::string_body>>(http::status::not_found, req_.version());
				res->set(http::field::server, "QuickMemes/1.0");
				res->set(http::field::content_type, "application/json");
				res->keep_alive(req_.keep_alive());
				res->body() = R"({"success": false, "data": null, "error": "File not found", "code": 1004})";
				res->prepare_payload();

				auto self = shared_from_this();
				http::async_write(stream_, *res, [self, res](beast::error_code ec, std::size_t bytes_transferred) {
					boost::ignore_unused(bytes_transferred);
					if (ec) {
						LOG_ERROR("session", "Write error (404 for file): " + ec.message());
						return;
					}
					if (res->need_eof()) {
						self->doClose();
						return;
					}
					self->doRead();
				});
			} else {
				auto res = std::make_shared<http::response<http::file_body>>(static_cast<http::status>(resProxy.status),
				                                                             req_.version());
				res->set(http::field::server, "QuickMemes/1.0");
				res->set(http::field::content_type, resProxy.contentType);
				res->keep_alive(req_.keep_alive());
				res->body() = std::move(file);
				res->prepare_payload();

				auto self = shared_from_this();
				http::async_write(stream_, *res, [self, res](beast::error_code ec, std::size_t bytes_transferred) {
					boost::ignore_unused(bytes_transferred);
					if (ec) {
						LOG_ERROR("session", "Write error (file): " + ec.message());
						return;
					}
					if (res->need_eof()) {
						self->doClose();
						return;
					}
					self->doRead();
				});
			}
		} else {
			auto res = std::make_shared<http::response<http::string_body>>(static_cast<http::status>(resProxy.status),
			                                                               req_.version());
			res->set(http::field::server, "QuickMemes/1.0");
			res->set(http::field::content_type, resProxy.contentType);
			res->keep_alive(req_.keep_alive());
			res->body() = std::move(resProxy.body);
			res->prepare_payload();

			auto self = shared_from_this();
			http::async_write(stream_, *res, [self, res](beast::error_code ec, std::size_t bytes_transferred) {
				boost::ignore_unused(bytes_transferred);
				if (ec) {
					LOG_ERROR("session", "Write error: " + ec.message());
					return;
				}
				if (res->need_eof()) {
					self->doClose();
					return;
				}
				self->doRead();
			});
		}
	}

	void doClose() {
		beast::error_code ec;
		stream_.socket().shutdown(tcp::socket::shutdown_send, ec);
	}
};

class ServerImpl {
public:
	ServerConfig                       config;
	net::io_context                    ioc;
	std::unique_ptr<tcp::acceptor>     acceptor;
	std::vector<std::thread>           ioThreads;
	std::shared_ptr<Router>            router;
	std::shared_ptr<net::steady_timer> maintTimer;

	void doAccept() {
		if (!acceptor || !acceptor->is_open()) return;
		acceptor->async_accept(boost::asio::make_strand(ioc), [this](boost::beast::error_code ec, tcp::socket socket) {
			if (!ec) {
				std::make_shared<HttpSession>(std::move(socket), router)->run();
			} else {
				LOG_ERROR("server", "Accept error: " + ec.message());
			}
			doAccept();
		});
	}

	void doMaintenance() {
		if (!maintTimer) return;
		maintTimer->expires_after(std::chrono::hours(24));
		maintTimer->async_wait([this](boost::beast::error_code ec) {
			if (!ec) {
				// 获取 Server 实例并执行维护（这里假设 ServerImpl 到 Server 的某种引用，
				// 或者直接在此处调用逻辑并让 Server 调用此处，
				// 但最清晰的办法是将逻辑抽离到本类的一个方法，然后 Server 调用它）
				performMaintenanceInternal();
				doMaintenance();
			}
		});
	}

	void performMaintenanceInternal() {
		if (config.logRetentionEnabled) { Logger::get().cleanOldLogs(config.logRetentionDays); }

		Database::get().purgeDeletedMemes(config.recycleBinRetentionDays);

		if (config.backupEnabled) {
			try {
				auto now = std::filesystem::file_time_type::clock::now();
				for (const auto &entry :
				     std::filesystem::directory_iterator(std::filesystem::path(config.dbPath).parent_path())) {
					if (entry.is_regular_file() && entry.path().string().find(".bak.") != std::string::npos) {
						auto ftime = std::filesystem::last_write_time(entry);
						if (std::chrono::duration_cast<std::chrono::hours>(now - ftime).count() >
						    24 * config.backupRetentionDays) {
							std::filesystem::remove(entry.path());
						}
					}
				}
			} catch (...) {}
		}
	}
};

Server::Server()
    : impl_(std::make_unique<ServerImpl>()) {}
Server::~Server() = default;

bool Server::start(const ServerConfig &config) {
	impl_->config = config;
	impl_->router = std::make_shared<Router>();
	impl_->router->setAuthToken(config.authToken);

	LOG_INFO("server", "Starting Server initialization...");

	try {
		Database::get().initialize(config.dbPath);
		if (!Database::get().checkIntegrity()) {
			LOG_ERROR("server", "Database integrity check failed. Attempting to recover from latest backup...");
			std::string                     latestBackup;
			std::filesystem::file_time_type latestTime = std::filesystem::file_time_type::min();
			try {
				for (const auto &entry :
				     std::filesystem::directory_iterator(std::filesystem::path(config.dbPath).parent_path())) {
					if (entry.is_regular_file() && entry.path().string().find(".bak.") != std::string::npos) {
						auto ftime = std::filesystem::last_write_time(entry);
						if (ftime > latestTime) {
							latestTime   = ftime;
							latestBackup = entry.path().string();
						}
					}
				}
			} catch (...) {}

			if (!latestBackup.empty() && Database::get().restoreDatabase(latestBackup)) {
				LOG_INFO("server", "Successfully recovered from backup: " + latestBackup);
				if (!Database::get().checkIntegrity()) {
					LOG_ERROR("server", "Integrity check still failed after restore.");
					return false;
				}
			} else {
				LOG_ERROR("server", "No valid backup available or restore failed.");
				return false;
			}
		} else if (config.backupEnabled) {
			auto backupPath = Database::get().backupDatabase();
			if (!backupPath.empty()) { LOG_INFO("server", "Created startup database backup: " + backupPath); }
		}
		Database::get().recoverFromCrash();
	} catch (const std::exception &e) {
		LOG_ERROR("server", std::string("Database init failed: ") + e.what());
		return false;
	}

	VisionModule::get().initialize(config.visionConfig);

	TaskQueue::get().initialize(config.workerCount, config.maxQueueSize, config.storagePath);

	try {
		auto address    = net::ip::make_address(config.bindAddress);
		impl_->acceptor = std::make_unique<tcp::acceptor>(impl_->ioc, tcp::endpoint(address, config.port));

		LOG_INFO("server", "Server listening on " + config.bindAddress + ":" + std::to_string(config.port));
		impl_->doAccept();

		impl_->maintTimer = std::make_shared<net::steady_timer>(impl_->ioc);
		impl_->doMaintenance();

		impl_->ioThreads.reserve(config.workerCount);
		for (auto i = 0; i < config.workerCount; ++i) {
			impl_->ioThreads.emplace_back([this] { impl_->ioc.run(); });
		}

	} catch (const std::exception &e) {
		LOG_ERROR("server", std::string("Server failed to bind/start: ") + e.what());
		return false;
	}

	return true;
}

void Server::stop() {
	LOG_INFO("server", "Server stopping...");

	impl_->ioc.stop();

	TaskQueue::get().shutdown();
	VisionModule::get().shutdown();
	Database::get().shutdown();

	LOG_INFO("server", "Server stopped.");
}

void Server::waitForStop() {
	for (auto &t : impl_->ioThreads) {
		if (t.joinable()) t.join();
	}
}

const ServerConfig &Server::getConfig() const {
	return impl_->config;
}

void Server::updateConfig(const ServerConfig &config) {
	impl_->config = config;
}

void Server::runMaintenanceTasks() {
	impl_->performMaintenanceInternal();
}

} // namespace quickmemes
