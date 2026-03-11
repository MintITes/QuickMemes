/**
 * @file http_client.cpp
 * @brief HTTP 客户端实现
 */

#include "vision/http_client.hpp"

#include "error_codes.hpp"
#include "utils/logger.hpp"

#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <cstdlib>
#include <iostream>
#include <regex>

namespace quickmemes {

namespace beast = boost::beast;
namespace http  = beast::http;
namespace net   = boost::asio;
namespace ssl   = net::ssl;
using tcp       = net::ip::tcp;

std::string
HttpClient::post(const std::string &url, const std::string &headers, const std::string &body, int timeoutSeconds) {
	try {
		// 1. 解析 URL
		// 支持 https://api.openai.com/v1/... 或者 http://localhost:11434/...
		std::regex  urlRegex(R"(^(https?)://([^/:]+)(?::(\d+))?(/.*)?$)");
		std::smatch urlMatchResults;

		if (!std::regex_match(url, urlMatchResults, urlRegex)) {
			throw ApiException(ERR_AI_REQUEST_FAILED, "Invalid URL format: " + url);
		}

		std::string protocol = urlMatchResults[1];
		std::string host     = urlMatchResults[2];
		std::string port =
		    urlMatchResults[3].str().empty() ? (protocol == "https" ? "443" : "80") : urlMatchResults[3].str();
		std::string target = urlMatchResults[4].str().empty() ? "/" : urlMatchResults[4].str();

		// 2. ASio IoContext & Connect
		net::io_context ioc;

		// 这里采用同步接口，依靠 Asio timeout/deadline_timer 能控制，但对于简单的 HttpClient，我们先直接调用。
		tcp::resolver resolver(ioc);
		auto const    results = resolver.resolve(host, port);

		// 3. 构建 HTTP 负载
		http::request<http::string_body> req{http::verb::post, target, 11};
		req.set(http::field::host, host);
		req.set(http::field::user_agent, BOOST_BEAST_VERSION_STRING);
		req.set(http::field::content_type, "application/json");

		// 简单按行分割解析额外 header
		std::istringstream headersStream(headers);
		std::string        headerLine;
		while (std::getline(headersStream, headerLine)) {
			if (headerLine.empty() || headerLine == "\r") continue;
			auto colonPos = headerLine.find(':');
			if (colonPos != std::string::npos) {
				std::string k = headerLine.substr(0, colonPos);
				std::string v = headerLine.substr(colonPos + 1);
				// trim
				v.erase(0, v.find_first_not_of(" \t"));
				v.erase(v.find_last_not_of(" \t\r\n") + 1);
				req.set(k, v);
			}
		}

		req.body() = body;
		req.prepare_payload();

		std::string responseBody;

		// 4. 发送请求与读取响应
		if (protocol == "https") {
			// TLS
			ssl::context ctx(ssl::context::tlsv12_client);
			// 默认启用证书验证；开发环境可通过 QM_SSL_NOVERIFY=1 跳过
			const char  *noVerify = std::getenv("QM_SSL_NOVERIFY");
			if (noVerify && std::string(noVerify) == "1") {
				ctx.set_verify_mode(ssl::verify_none);
			} else {
				ctx.set_default_verify_paths();
				ctx.set_verify_mode(ssl::verify_peer);
			}

			beast::ssl_stream<beast::tcp_stream> stream(ioc, ctx);
			if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str())) {
				beast::error_code ec{static_cast<int>(::ERR_get_error()), net::error::get_ssl_category()};
				throw beast::system_error{ec};
			}

			beast::get_lowest_layer(stream).connect(results);
			// 简单超时通过 beast tcp_stream 设置
			beast::get_lowest_layer(stream).expires_after(std::chrono::seconds(timeoutSeconds));

			stream.handshake(ssl::stream_base::client);
			http::write(stream, req);

			beast::flat_buffer                buffer;
			http::response<http::string_body> res;

			http::read(stream, buffer, res);

			beast::error_code ec;
			stream.shutdown(ec);
			// 收到 non_recoverable 或 EOF 往往在此处出现，不抛异常

			if (res.result() != http::status::ok) {
				throw ApiException(ERR_AI_REQUEST_FAILED,
				                   "HTTP Request returned " + std::to_string(res.result_int()) +
				                       ". Body: " + res.body());
			}
			responseBody = res.body();
		} else {
			// TCP
			beast::tcp_stream stream(ioc);
			stream.connect(results);
			stream.expires_after(std::chrono::seconds(timeoutSeconds));

			http::write(stream, req);
			beast::flat_buffer                buffer;
			http::response<http::string_body> res;

			http::read(stream, buffer, res);
			beast::error_code ec;
			stream.socket().shutdown(tcp::socket::shutdown_both, ec);

			if (res.result() != http::status::ok) {
				throw ApiException(ERR_AI_REQUEST_FAILED,
				                   "HTTP Request returned " + std::to_string(res.result_int()) +
				                       ". Body: " + res.body());
			}
			responseBody = res.body();
		}

		return responseBody;

	} catch (std::exception const &e) {
		LOG_ERROR("http", std::string("HttpClient::post failed: ") + e.what());
		throw ApiException(ERR_AI_REQUEST_FAILED, std::string("HTTP Request error: ") + e.what());
	}
}

std::string HttpClient::get(const std::string &url, const std::string &headers, int timeoutSeconds) {
	try {
		std::regex  urlRegex(R"(^(https?)://([^/:]+)(?::(\d+))?(/.*)?$)");
		std::smatch urlMatchResults;

		if (!std::regex_match(url, urlMatchResults, urlRegex)) {
			throw ApiException(ERR_AI_REQUEST_FAILED, "Invalid URL format: " + url);
		}

		std::string protocol = urlMatchResults[1];
		std::string host     = urlMatchResults[2];
		std::string port =
		    urlMatchResults[3].str().empty() ? (protocol == "https" ? "443" : "80") : urlMatchResults[3].str();
		std::string target = urlMatchResults[4].str().empty() ? "/" : urlMatchResults[4].str();

		net::io_context ioc;

		tcp::resolver resolver(ioc);
		auto const    results = resolver.resolve(host, port);

		http::request<http::string_body> req{http::verb::get, target, 11};
		req.set(http::field::host, host);
		req.set(http::field::user_agent, BOOST_BEAST_VERSION_STRING);

		std::istringstream headersStream(headers);
		std::string        headerLine;
		while (std::getline(headersStream, headerLine)) {
			if (headerLine.empty() || headerLine == "\r") continue;
			auto colonPos = headerLine.find(':');
			if (colonPos != std::string::npos) {
				std::string k = headerLine.substr(0, colonPos);
				std::string v = headerLine.substr(colonPos + 1);
				v.erase(0, v.find_first_not_of(" \t"));
				v.erase(v.find_last_not_of(" \t\r\n") + 1);
				req.set(k, v);
			}
		}

		req.prepare_payload();

		std::string responseBody;

		if (protocol == "https") {
			ssl::context ctx(ssl::context::tlsv12_client);
			const char  *noVerify = std::getenv("QM_SSL_NOVERIFY");
			if (noVerify && std::string(noVerify) == "1") {
				ctx.set_verify_mode(ssl::verify_none);
			} else {
				ctx.set_default_verify_paths();
				ctx.set_verify_mode(ssl::verify_peer);
			}

			beast::ssl_stream<beast::tcp_stream> stream(ioc, ctx);
			if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str())) {
				beast::error_code ec{static_cast<int>(::ERR_get_error()), net::error::get_ssl_category()};
				throw beast::system_error{ec};
			}

			beast::get_lowest_layer(stream).connect(results);
			beast::get_lowest_layer(stream).expires_after(std::chrono::seconds(timeoutSeconds));

			stream.handshake(ssl::stream_base::client);
			http::write(stream, req);

			beast::flat_buffer                buffer;
			http::response<http::string_body> res;

			http::read(stream, buffer, res);

			beast::error_code ec;
			stream.shutdown(ec);

			if (res.result() != http::status::ok) {
				throw ApiException(ERR_AI_REQUEST_FAILED,
				                   "HTTP Request returned " + std::to_string(res.result_int()) +
				                       ". Body: " + res.body());
			}
			responseBody = res.body();
		} else {
			beast::tcp_stream stream(ioc);
			stream.connect(results);
			stream.expires_after(std::chrono::seconds(timeoutSeconds));

			http::write(stream, req);
			beast::flat_buffer                buffer;
			http::response<http::string_body> res;

			http::read(stream, buffer, res);
			beast::error_code ec;
			stream.socket().shutdown(tcp::socket::shutdown_both, ec);

			if (res.result() != http::status::ok) {
				throw ApiException(ERR_AI_REQUEST_FAILED,
				                   "HTTP Request returned " + std::to_string(res.result_int()) +
				                       ". Body: " + res.body());
			}
			responseBody = res.body();
		}

		return responseBody;

	} catch (std::exception const &e) {
		LOG_ERROR("http", std::string("HttpClient::get failed: ") + e.what());
		throw ApiException(ERR_AI_REQUEST_FAILED, std::string("HTTP Request error: ") + e.what());
	}
}

} // namespace quickmemes
