#pragma once
#include <functional>
#include <memory>
#include <string>

namespace quickmemes {

struct HttpRequestProxy {
	std::string method;
	std::string path;
	std::string query;
	std::string body;
	std::string header_auth;
};

struct HttpResponseProxy {
	unsigned int status = 200;
	std::string body;
	std::string filePath;
	std::string contentType = "application/json";
};

using RouteHandler = std::function<void(const HttpRequestProxy &, HttpResponseProxy &)>;

class RouterImpl;

class Router {
public:
	Router();
	~Router();

	void setAuthToken(const std::string &token);
	const std::string &getAuthToken() const { return authToken_; }

	void registerRoute(const std::string &method, const std::string &path, RouteHandler handler);

	void dispatch(const HttpRequestProxy &req, HttpResponseProxy &res);

	static bool verifyAuthToken(const std::string &token, const std::string &expected);

private:
	std::unique_ptr<RouterImpl> impl_;
	std::string authToken_;
};

} // namespace quickmemes
