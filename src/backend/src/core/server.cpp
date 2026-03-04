/**
 * @file server.cpp
 * @brief Server 核心启动类实现
 */

#include "core/server.hpp"
#include "utils/logger.hpp"
#include "core/task_queue.hpp"
#include "vision/vision.hpp"
#include "db/database.hpp"

namespace quickmemes {

class ServerImpl {
public:
    ServerConfig config;
    // TODO: Boost Asio io_context, tcp::acceptor
};

Server::Server() : impl_(std::make_unique<ServerImpl>()) {}
Server::~Server() = default;

bool Server::start(const ServerConfig& config) {
    impl_->config = config;

    LOG_INFO("server", "Starting Server initialization...");

    // TODO: Database::initialize
    // TODO: VisionModule::initialize
    
    TaskQueue::get().initialize(config.workerCount, config.maxQueueSize);

    // TODO: 启动 Boost.Asio 监听及接收循环

    LOG_INFO("server", "Server successfully started. TODO: block loop");
    return true;
}

void Server::stop() {
    LOG_INFO("server", "Server stopping...");

    TaskQueue::get().shutdown();

    // TODO: 停止 asio, Database::shutdown, Vision::shutdown

    LOG_INFO("server", "Server stopped.");
}

const ServerConfig& Server::getConfig() const {
    return impl_->config;
}

}  // namespace quickmemes
