/**
 * @file test_http_client.cpp
 * @brief HttpClient implementation tests with local loopback server.
 */

#include "error_codes.hpp"
#include "vision/http_client.hpp"

#include <boost/asio.hpp>
#include <gtest/gtest.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdlib>
#include <cctype>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace quickmemes::testing {
namespace {

std::string toLower(std::string value) {
	for (auto &ch : value) {
		ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
	}
	return value;
}

std::string ltrim(std::string value) {
	size_t pos = value.find_first_not_of(" \t");
	if (pos == std::string::npos) { return ""; }
	return value.substr(pos);
}

struct CapturedRequest {
	std::string                                method;
	std::string                                target;
	std::unordered_map<std::string, std::string> headers;
	std::string                                body;
};

struct ServerResponse {
	int                                       status = 200;
	std::string                               body;
	std::vector<std::pair<std::string, std::string>> headers;
	int                                       delayMs = 0;
};

class LocalHttpServer {
public:
	explicit LocalHttpServer(ServerResponse response)
	    : response_(std::move(response))
	    , acceptor_(ioc_, boost::asio::ip::tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), 0)) {
		port_ = acceptor_.local_endpoint().port();
		thread_ = std::thread([this]() { runOnce(); });
	}

	~LocalHttpServer() {
		try {
			acceptor_.close();
		} catch (...) {}
		if (thread_.joinable()) { thread_.join(); }
	}

	std::string url(const std::string &path) const {
		return "http://127.0.0.1:" + std::to_string(port_) + path;
	}

	bool waitForRequest(std::chrono::milliseconds timeout) {
		std::unique_lock<std::mutex> lock(mtx_);
		return cv_.wait_for(lock, timeout, [&]() { return received_; });
	}

	CapturedRequest request() const {
		std::lock_guard<std::mutex> lock(mtx_);
		return request_;
	}

private:
	void runOnce() {
		try {
			boost::asio::ip::tcp::socket socket(ioc_);
			acceptor_.accept(socket);
			auto req = readRequest(socket);

			{
				std::lock_guard<std::mutex> lock(mtx_);
				request_  = std::move(req);
				received_ = true;
			}
			cv_.notify_all();

			if (response_.delayMs > 0) {
				std::this_thread::sleep_for(std::chrono::milliseconds(response_.delayMs));
			}

			std::string response = buildResponse();
			boost::asio::write(socket, boost::asio::buffer(response));
			boost::system::error_code ec;
			socket.shutdown(boost::asio::ip::tcp::socket::shutdown_both, ec);
		} catch (...) {
			std::lock_guard<std::mutex> lock(mtx_);
			received_ = true;
			cv_.notify_all();
		}
	}

	CapturedRequest readRequest(boost::asio::ip::tcp::socket &socket) {
		CapturedRequest req;
		boost::asio::streambuf buffer;
		boost::asio::read_until(socket, buffer, "\r\n\r\n");

		std::istream stream(&buffer);
		std::string line;
		if (std::getline(stream, line)) {
			if (!line.empty() && line.back() == '\r') { line.pop_back(); }
			std::istringstream firstLine(line);
			firstLine >> req.method >> req.target;
		}

		size_t contentLength = 0;
		while (std::getline(stream, line)) {
			if (line == "\r" || line.empty()) { break; }
			if (!line.empty() && line.back() == '\r') { line.pop_back(); }
			auto pos = line.find(':');
			if (pos == std::string::npos) { continue; }
			std::string key = toLower(line.substr(0, pos));
			std::string value = ltrim(line.substr(pos + 1));
			req.headers[key] = value;
			if (key == "content-length") {
				contentLength = static_cast<size_t>(std::strtoul(value.c_str(), nullptr, 10));
			}
		}

		if (contentLength > 0) {
			req.body.resize(contentLength);
			size_t already = 0;
			if (buffer.size() > 0) {
				stream.read(&req.body[0], std::min(contentLength, static_cast<size_t>(buffer.size())));
				already = static_cast<size_t>(stream.gcount());
			}
			if (already < contentLength) {
				boost::asio::read(socket,
				                  boost::asio::buffer(&req.body[already], contentLength - already));
			}
		}

		return req;
	}

	std::string buildResponse() const {
		std::ostringstream oss;
		oss << "HTTP/1.1 " << response_.status << " "
		    << (response_.status == 200 ? "OK" : "ERR") << "\r\n";
		for (const auto &header : response_.headers) {
			oss << header.first << ": " << header.second << "\r\n";
		}
		oss << "Content-Length: " << response_.body.size() << "\r\n\r\n";
		oss << response_.body;
		return oss.str();
	}

	ServerResponse                   response_;
	mutable std::mutex               mtx_;
	std::condition_variable          cv_;
	CapturedRequest                  request_;
	bool                             received_ = false;
	boost::asio::io_context          ioc_;
	boost::asio::ip::tcp::acceptor   acceptor_;
	unsigned short                   port_ = 0;
	std::thread                      thread_;
};

} // namespace

TEST(HttpClientTest, Get_SendsHeadersAndReturnsBody) {
	ServerResponse response;
	response.status = 200;
	response.body   = "pong";
	response.headers.push_back({"Content-Type", "text/plain"});

	LocalHttpServer server(response);

	HttpClient client;
	std::string body = client.get(server.url("/ping?x=1"), "X-Test: Alpha\r\nX-Second: Two\r\n", 2);
	ASSERT_TRUE(server.waitForRequest(std::chrono::seconds(2)));
	auto req = server.request();

	EXPECT_EQ(body, "pong");
	EXPECT_EQ(req.method, "GET");
	EXPECT_EQ(req.target, "/ping?x=1");
	EXPECT_EQ(req.headers["x-test"], "Alpha");
	EXPECT_EQ(req.headers["x-second"], "Two");
}

TEST(HttpClientTest, Post_SendsBodyAndHeaders) {
	ServerResponse response;
	response.status = 200;
	response.body   = "ok";
	response.headers.push_back({"Content-Type", "application/json"});

	LocalHttpServer server(response);

	HttpClient client;
	std::string body = client.post(server.url("/submit"), "X-Trace: 123\r\n", R"({"k":"v"})", 2);
	ASSERT_TRUE(server.waitForRequest(std::chrono::seconds(2)));
	auto req = server.request();

	EXPECT_EQ(body, "ok");
	EXPECT_EQ(req.method, "POST");
	EXPECT_EQ(req.target, "/submit");
	EXPECT_EQ(req.headers["x-trace"], "123");
	EXPECT_EQ(req.body, R"({"k":"v"})");
	EXPECT_EQ(req.headers["content-type"], "application/json");
}

TEST(HttpClientTest, Non2xx_ThrowsApiException) {
	ServerResponse response;
	response.status = 500;
	response.body   = "bad";

	LocalHttpServer server(response);

	HttpClient client;
	try {
		(void)client.get(server.url("/error"), "", 2);
		FAIL() << "Expected ApiException";
	} catch (const ApiException &e) {
		EXPECT_EQ(e.code(), ERR_AI_REQUEST_FAILED);
	}
}

TEST(HttpClientTest, InvalidUrl_ThrowsApiException) {
	HttpClient client;
	try {
		(void)client.get("not-a-url", "", 1);
		FAIL() << "Expected ApiException";
	} catch (const ApiException &e) {
		EXPECT_EQ(e.code(), ERR_AI_REQUEST_FAILED);
	}
}

TEST(HttpClientTest, ConnectFailure_ThrowsApiException) {
	HttpClient client;
	try {
		(void)client.get("http://127.0.0.1:9/slow", "", 1);
		FAIL() << "Expected ApiException";
	} catch (const ApiException &e) {
		EXPECT_EQ(e.code(), ERR_AI_REQUEST_FAILED);
	}
}

} // namespace quickmemes::testing
