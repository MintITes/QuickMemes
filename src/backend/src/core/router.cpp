#include "core/router.hpp"

#include "core/handlers.hpp"
#include "utils/logger.hpp"

#include <iostream>
#include <regex>
#include <unordered_map>

namespace quickmemes {

class RouterImpl {
public:
	std::unordered_map<std::string, RouteHandler>                                  exactRoutes;
	std::vector<std::pair<std::function<bool(const std::string &)>, RouteHandler>> dynamicRoutes;
};

Router::Router()
    : impl_(std::make_unique<RouterImpl>()) {
	auto impl = impl_.get();

	impl->exactRoutes["GET /api/health"]                    = handleGetHealth;
	impl->exactRoutes["POST /api/import"]                   = handlePostImport;
	impl->exactRoutes["POST /api/import/cancel"]            = handlePostImportCancel;
	impl->exactRoutes["POST /api/memes/search"]             = handlePostMemesSearch;
	impl->exactRoutes["POST /api/tags"]                     = handlePostTags;
	impl->exactRoutes["GET /api/tags"]                      = handleGetTags;
	impl->exactRoutes["POST /api/export"]                   = handlePostExport;
	impl->exactRoutes["DELETE /api/memes/trash/purge"]      = handleDeleteTrashPurge;
	impl->exactRoutes["DELETE /api/memes/batch"]            = handleDeleteMemesBatch;
	impl->exactRoutes["POST /api/memes/batch/tags"]         = handlePostMemesBatchTags;
	impl->exactRoutes["GET /api/memes/trash"]               = handleGetMemesTrash;
	impl->exactRoutes["GET /api/categories"]                = handleGetCategories;
	impl->exactRoutes["POST /api/categories"]               = handlePostCategory;
	impl->exactRoutes["POST /api/memes/batch/category"]     = handlePostMemesBatchCategory;
	impl->exactRoutes["POST /api/admin/rebuild-embeddings"] = handlePostAdminRebuildEmbeddings;
	impl->exactRoutes["PATCH /api/config"]                  = handlePatchConfig;

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "GET /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find('/');
		                               return pos != std::string::npos && rest.substr(pos) == "/file";
	                               },
	                               handleGetMemeFile});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "GET /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find('/');
		                               return pos != std::string::npos && rest.substr(pos) == "/thumbnail";
	                               },
	                               handleGetMemeThumbnail});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "GET /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto rest = key.substr(p.size());
		                               return rest.find_first_not_of("0123456789") == std::string::npos &&
		                                      !rest.empty();
	                               },
	                               handleGetMeme});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "PUT /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto rest = key.substr(p.size());
		                               return rest.find_first_not_of("0123456789") == std::string::npos &&
		                                      !rest.empty();
	                               },
	                               handlePutMeme});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "DELETE /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto rest = key.substr(p.size());
		                               return rest.find_first_not_of("0123456789") == std::string::npos &&
		                                      !rest.empty();
	                               },
	                               handleDeleteMeme});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "POST /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find('/');
		                               return pos != std::string::npos && rest.substr(pos) == "/tags";
	                               },
	                               handlePostMemeTags});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "DELETE /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find("/tags/");
		                               return pos != std::string::npos &&
		                                      rest.find_first_not_of("0123456789", pos + 6) == std::string::npos &&
		                                      rest.size() > pos + 6;
	                               },
	                               handleDeleteMemeTags});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "POST /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find('/');
		                               return pos != std::string::npos && rest.substr(pos) == "/restore";
	                               },
	                               handlePostMemeRestore});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "POST /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find('/');
		                               return pos != std::string::npos && rest.substr(pos) == "/use";
	                               },
	                               handlePostMemeUse});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "POST /api/meme/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto   rest = key.substr(p.size());
		                               size_t pos  = rest.find('/');
		                               return pos != std::string::npos &&
		                                      (rest.substr(pos) == "/ocr" || rest.substr(pos) == "/ocr/");
	                               },
	                               handlePostMemeOcr});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "DELETE /api/tags/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto rest = key.substr(p.size());
		                               return rest.find_first_not_of("0123456789") == std::string::npos &&
		                                      !rest.empty();
	                               },
	                               handleDeleteTag});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "PUT /api/categories/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto rest = key.substr(p.size());
		                               return rest.find_first_not_of("0123456789") == std::string::npos &&
		                                      !rest.empty();
	                               },
	                               handlePutCategory});

	impl->dynamicRoutes.push_back({[](const std::string &key) {
		                               const std::string p = "DELETE /api/categories/";
		                               if (key.compare(0, p.size(), p) != 0) return false;
		                               auto rest = key.substr(p.size());
		                               return rest.find_first_not_of("0123456789") == std::string::npos &&
		                                      !rest.empty();
	                               },
	                               handleDeleteCategory});
}

Router::~Router() = default;

void Router::registerRoute(const std::string &method, const std::string &path, RouteHandler handler) {
	auto key                = method + " " + path;
	impl_->exactRoutes[key] = handler;
}

void Router::setAuthToken(const std::string &token) {
	authToken_ = token;
}

void Router::dispatch(const HttpRequestProxy &req, HttpResponseProxy &res) {
	auto key  = req.method + " " + req.path;
	auto impl = impl_.get();

	if (req.path != "/api/health" && !authToken_.empty()) {
		std::string expectedPrefix = "Bearer ";
		if (req.header_auth.size() <= expectedPrefix.size() ||
		    req.header_auth.substr(0, expectedPrefix.size()) != expectedPrefix) {
			res.status = 401;
			res.body   = R"({"success": false, "data": null, "error": "Unauthorized", "code": 401})";
			return;
		}

		if (!verifyAuthToken(req.header_auth.substr(expectedPrefix.size()), authToken_)) {
			res.status = 403;
			res.body   = R"({"success": false, "data": null, "error": "Forbidden", "code": 403})";
			return;
		}
	}

	auto it = impl_->exactRoutes.find(key);
	if (it != impl_->exactRoutes.end()) {
		try {
			it->second(req, res);
		} catch (...) {
			res.status = 500;
			res.body   = R"({"success": false, "data": null, "error": "Internal Server Error", "code": 1099})";
		}
		return;
	}

	for (auto &route : impl_->dynamicRoutes) {
		if (route.first(key)) {
			try {
				route.second(req, res);
			} catch (const std::exception &e) {
				res.status = 500;
				res.body   = R"({"success": false, "data": null, "error": "Internal Server Error", "code": 1099})";
			}
			return;
		}
	}

	res.status = 404;
	res.body   = R"({"success": false, "data": null, "error": "Not Found", "code": 1002})";
}

bool Router::verifyAuthToken(const std::string &token, const std::string &expected) {
	return token == expected;
}

} // namespace quickmemes
