/**
 * @file http_client.cpp
 * @brief HTTP 客户端实现
 */

#include "vision/http_client.hpp"

#include "error_codes.hpp"
#include "utils/logger.hpp"

#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/host_name_verification.hpp>
#include <boost/asio/steady_timer.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <regex>
#include <sstream>
#include <utility>

namespace quickmemes {

namespace beast = boost::beast;
namespace http  = beast::http;
namespace net   = boost::asio;
namespace ssl   = net::ssl;
using tcp       = net::ip::tcp;

namespace {

using ResolveResults = tcp::resolver::results_type;

ResolveResults resolveWithTimeout(net::io_context &ioc,
                                  tcp::resolver    &resolver,
                                  const std::string &host,
                                  const std::string &port,
                                  std::chrono::seconds timeout) {
	ResolveResults         results;
	boost::system::error_code ec;
	bool                   completed = false;

	net::steady_timer timer(ioc);
	timer.expires_after(timeout);
	timer.async_wait([&](const boost::system::error_code &timerEc) {
		if (timerEc || completed) { return; }
		completed = true;
		ec        = net::error::timed_out;
		resolver.cancel();
	});

	resolver.async_resolve(host, port, [&](const boost::system::error_code &resolveEc, ResolveResults resolved) {
		if (completed) { return; }
		completed = true;
		ec        = resolveEc;
		results    = std::move(resolved);
		timer.cancel();
	});

	ioc.restart();
	ioc.run();
	ioc.restart();

	if (ec) { throw boost::system::system_error(ec); }
	return results;
}

constexpr std::uint64_t kMaxResponseBodyBytes = 10 * 1024 * 1024;

template <typename Body>
std::string readHttpResponseBody(Body &&stream, const std::string &methodTag) {
	beast::flat_buffer buffer;
	http::response_parser<http::string_body> parser;
	parser.body_limit(kMaxResponseBodyBytes);

	http::read(stream, buffer, parser);

	auto res = parser.get();
	if (res.result() != http::status::ok) {
		throw ApiException(ERR_AI_REQUEST_FAILED,
		                   methodTag + " HTTP Request returned " + std::to_string(res.result_int()) +
		                       ". Body: " + res.body());
	}
	return res.body();
}

} // namespace

std::string
HttpClient::post(const std::string &url, const std::string &headers, const std::string &body, int timeoutSeconds) {
	try {
		if (timeoutSeconds <= 0) { timeoutSeconds = 1; }
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

		tcp::resolver resolver(ioc);
		auto const    results = resolveWithTimeout(ioc, resolver, host, port, std::chrono::seconds(timeoutSeconds));

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
			stream.set_verify_callback(ssl::host_name_verification(host));

			beast::get_lowest_layer(stream).expires_after(std::chrono::seconds(timeoutSeconds));
			beast::get_lowest_layer(stream).connect(results);

			stream.handshake(ssl::stream_base::client);
			http::write(stream, req);

			responseBody = readHttpResponseBody(stream, "POST");

			beast::error_code ec;
			stream.shutdown(ec);
		} else {
			// TCP
			beast::tcp_stream stream(ioc);
			stream.expires_after(std::chrono::seconds(timeoutSeconds));
			stream.connect(results);

			http::write(stream, req);
			responseBody = readHttpResponseBody(stream, "POST");
			beast::error_code ec;
			stream.socket().shutdown(tcp::socket::shutdown_both, ec);
		}

		return responseBody;

	} catch (std::exception const &e) {
		LOG_ERROR("http", std::string("HttpClient::post failed: ") + e.what());
		throw ApiException(ERR_AI_REQUEST_FAILED, std::string("HTTP Request error: ") + e.what());
	}
}

std::string HttpClient::get(const std::string &url, const std::string &headers, int timeoutSeconds) {
	try {
		if (timeoutSeconds <= 0) { timeoutSeconds = 1; }
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
		auto const    results = resolveWithTimeout(ioc, resolver, host, port, std::chrono::seconds(timeoutSeconds));

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
			stream.set_verify_callback(ssl::host_name_verification(host));

			beast::get_lowest_layer(stream).expires_after(std::chrono::seconds(timeoutSeconds));
			beast::get_lowest_layer(stream).connect(results);

			stream.handshake(ssl::stream_base::client);
			http::write(stream, req);

			responseBody = readHttpResponseBody(stream, "GET");

			beast::error_code ec;
			stream.shutdown(ec);
		} else {
			beast::tcp_stream stream(ioc);
			stream.expires_after(std::chrono::seconds(timeoutSeconds));
			stream.connect(results);

			http::write(stream, req);
			responseBody = readHttpResponseBody(stream, "GET");
			beast::error_code ec;
			stream.socket().shutdown(tcp::socket::shutdown_both, ec);
		}

		return responseBody;

	} catch (std::exception const &e) {
		LOG_ERROR("http", std::string("HttpClient::get failed: ") + e.what());
		throw ApiException(ERR_AI_REQUEST_FAILED, std::string("HTTP Request error: ") + e.what());
	}
}

} // namespace quickmemes
