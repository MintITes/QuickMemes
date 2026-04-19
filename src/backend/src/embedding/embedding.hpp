#pragma once
/**
 * @file embedding.hpp
 * @brief Embedding 模块接口声明
 */

#include "error_codes.hpp"
#include "utils/config_parser.hpp"
#include "vision/http_client.hpp"

#include <memory>
#include <shared_mutex>
#include <string>
#include <vector>

namespace quickmemes {

struct EmbeddingError {
	int         statusCode = 0;
	std::string providerCode;
	std::string message;
	bool        retryable = false;
};

class EmbeddingException : public ApiException {
public:
	EmbeddingException(int code, const std::string &message, EmbeddingError error)
	    : ApiException(code, message)
	    , error_(std::move(error)) {}

	[[nodiscard]] const EmbeddingError &error() const noexcept {
		return error_;
	}

private:
	EmbeddingError error_;
};

class EmbeddingModule {
public:
	static constexpr int kDefaultDimensions = 512;
	static constexpr int kMinDimensions     = 1;
	static constexpr int kMaxDimensions     = 1024;

	static EmbeddingModule &get() {
		static EmbeddingModule instance;
		return instance;
	}

	explicit EmbeddingModule(std::shared_ptr<HttpClientInterface> httpClient = std::make_shared<HttpClient>());
	~EmbeddingModule();

	bool initialize(const EmbeddingConfig &config);
	void shutdown();
	bool reconfigure(const EmbeddingConfig &config);

	void setHttpClient(std::shared_ptr<HttpClientInterface> client);

	[[nodiscard]] bool isAvailable() const;
	[[nodiscard]] int  getDimensions() const;
	[[nodiscard]] EmbeddingConfig getConfig() const;

	static int sanitizeDimensions(const std::string &provider, const std::string &model, int dimensions);
	static bool isSupportedProviderModel(const std::string &provider, const std::string &model);

	std::vector<float>              generateEmbedding(const std::string &text, const std::string &task = "text-matching");
	std::vector<std::vector<float>> generateEmbeddings(const std::vector<std::string> &texts,
	                                                   const std::string              &task = "text-matching");

private:
	struct RuntimeState {
		EmbeddingConfig                      config{};
		std::shared_ptr<HttpClientInterface> httpClient;
		bool                                 isAvailable = false;
	};

	RuntimeState  buildState(const EmbeddingConfig &config,
	                         std::shared_ptr<HttpClientInterface> client,
	                         bool                                 allowUnavailable) const;
	EmbeddingError parseApiError(const std::exception &e) const;
	EmbeddingError parseApiError(int statusCode, const std::string &body) const;
	bool           shouldRetry(const EmbeddingError &error) const;
	std::string    buildHeaders(const EmbeddingConfig &config) const;
	std::string    buildRequestBody(const EmbeddingConfig       &config,
	                                const std::vector<std::string> &texts,
	                                const std::string              &task) const;
	void           validateTask(const std::string &task) const;

	mutable std::shared_mutex stateMutex_;
	RuntimeState              state_{};
};

} // namespace quickmemes
