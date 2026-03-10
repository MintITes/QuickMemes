#pragma once
/**
 * @file server.hpp
 * @brief Boot.Beast HTTP / WebSocket 服务器封装
 *
 * 启动和管理单例核心服务。
 */

#include "utils/config_parser.hpp"

#include <memory>
#include <string>

namespace quickmemes {

class ServerImpl;

/**
 * @brief HTTP/WS 核心服务器管理类
 */
class Server {
public:
	Server();
	~Server();

	/**
	 * @brief 启动服务器
	 *
	 * 1. 启动 Database 初始化
	 * 2. 启动 Vision 初始化
	 * 3. 启动 TaskQueue 线程池
	 * 4. 绑定端口开始监听请求
	 *
	 * @param config ServerConfig 全局配置
	 * @return bool 启动成功返回 true
	 */
	bool start(const ServerConfig &config);

	/**
	 * @brief 平滑关闭服务器
	 *
	 * 停止接收新请求，等待处理中请求完成，关闭所有模块。
	 */
	void stop();

	/**
	 * @brief 阻塞当前线程直到服务器停止
	 *
	 * join 所有 IO 工作线程，阻塞直到 io_context 结束。
	 */
	void waitForStop();

	/**
	 * @brief 获取当前全局配置（只读）
	 */
	const ServerConfig &getConfig() const;

	/**
	 * @brief 更新全局配置（仅限内存）
	 */
	void updateConfig(const ServerConfig &config);

	/**
	 * @brief 执行例行维护任务
	 *
	 * 包含清理过期日志、清理回收站、管理备份文件。
	 * 该方法公开以支持自动化测试触发。
	 */
	void runMaintenanceTasks();

private:
	std::unique_ptr<ServerImpl> impl_; ///< Pimpl 模式隐藏 Boost/Asio 细节
};

} // namespace quickmemes
