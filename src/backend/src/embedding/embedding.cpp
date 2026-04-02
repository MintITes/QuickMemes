/**
 * @file embedding.cpp
 * @brief Embedding 模块实现
 */

#include "embedding/embedding.hpp"

#include "utils/logger.hpp"

#include <algorithm>
#include <cctype>
#include <nlohmann/json.hpp>
#include <mutex>
#include <ranges>
#include <regex>
#include <sstream>
#include <string_view>

namespace quickmemes {

namespace {

std::string trimCopy(std::string value) {
	auto notSpace = [](unsigned char ch) { return !std::isspace(ch); };
	value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
	value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(), value.end());
	return value;
}

EmbeddingError makeError(int statusCode, std::string providerCode, std::string message, bool retryable) {
	return {statusCode, std::move(providerCode), std::move(message), retryable};
}

} // namespace

EmbeddingModule::EmbeddingModule(std::shared_ptr<HttpClientInterface> httpClient)
{
	if (!httpClient) {
		httpClient = std::make_shared<HttpClient>();
	}
	state_.httpClient = std::move(httpClient);
	state_.config.dimensions = kDefaultDimensions;
}

EmbeddingModule::~EmbeddingModule() = default;

EmbeddingModule::RuntimeState EmbeddingModule::buildState(const EmbeddingConfig &config,
                                                          std::shared_ptr<HttpClientInterface> client,
                                                          bool                                 allowUnavailable) const {
	if (!client) {
		throw std::invalid_argument("Embedding http client must not be null");
	}

	EmbeddingConfig normalized = config;
	normalized.dimensions      = sanitizeDimensions(config.provider, config.model, config.dimensions);
	if (normalized.timeoutSeconds <= 0) {
		if (!allowUnavailable) { throw std::invalid_argument("Embedding timeoutSeconds must be positive"); }
		normalized.timeoutSeconds = 30;
	}
	if (normalized.maxRetries < 0) {
		if (!allowUnavailable) { throw std::invalid_argument("Embedding maxRetries must be non-negative"); }
		normalized.maxRetries = 0;
	}

	const bool available = !normalized.apiKey.empty() && !normalized.apiUrl.empty() &&
	                       isSupportedProviderModel(normalized.provider, normalized.model);
	if (!available) {
		LOG_WARN("embedding",
		         "Embedding unavailable. provider=" + normalized.provider + ", model=" + normalized.model +
		             ", apiUrl configured=" + std::string(normalized.apiUrl.empty() ? "false" : "true") +
		             ", apiKey configured=" + std::string(normalized.apiKey.empty() ? "false" : "true"));
	}

	return RuntimeState{std::move(normalized), std::move(client), available};
}

void EmbeddingModule::setHttpClient(std::shared_ptr<HttpClientInterface> client) {
	if (!client) { throw std::invalid_argument("Embedding http client must not be null"); }

	std::unique_lock lock(stateMutex_);
	state_.httpClient = std::move(client);
}

bool EmbeddingModule::initialize(const EmbeddingConfig &config) {
	std::shared_ptr<HttpClientInterface> client;
	{
		std::shared_lock lock(stateMutex_);
		client = state_.httpClient;
	}

	auto nextState = buildState(config, std::move(client), true);
	{
		std::unique_lock lock(stateMutex_);
		state_ = nextState;
	}

	if (!nextState.isAvailable) {
		LOG_WARN("embedding",
		         "Embedding unavailable. provider=" + nextState.config.provider + ", model=" + nextState.config.model +
		             ", apiUrl configured=" + std::string(nextState.config.apiUrl.empty() ? "false" : "true") +
		             ", apiKey configured=" + std::string(nextState.config.apiKey.empty() ? "false" : "true"));
	} else {
		LOG_INFO("embedding",
		         "EmbeddingModule initialized. provider=" + nextState.config.provider +
		             ", model=" + nextState.config.model +
		             ", dimensions=" + std::to_string(nextState.config.dimensions));
	}

	return nextState.isAvailable;
}

void EmbeddingModule::shutdown() {
	std::unique_lock lock(stateMutex_);
	state_.isAvailable = false;
	LOG_INFO("embedding", "EmbeddingModule shutdown.");
}

bool EmbeddingModule::reconfigure(const EmbeddingConfig &config) {
	std::shared_ptr<HttpClientInterface> client;
	{
		std::shared_lock lock(stateMutex_);
		client = state_.httpClient;
	}

	try {
		auto nextState = buildState(config, std::move(client), false);
		{
			std::unique_lock lock(stateMutex_);
			state_ = nextState;
		}
		LOG_INFO("embedding",
		         "EmbeddingModule reconfigured. provider=" + nextState.config.provider +
		             ", model=" + nextState.config.model +
		             ", dimensions=" + std::to_string(nextState.config.dimensions));
		return true;
	} catch (const std::exception &e) {
		LOG_WARN("embedding", std::string("EmbeddingModule reconfigure rejected: ") + e.what());
		return false;
	}
}

bool EmbeddingModule::isAvailable() const {
	std::shared_lock lock(stateMutex_);
	return state_.isAvailable;
}

int EmbeddingModule::getDimensions() const {
	std::shared_lock lock(stateMutex_);
	return state_.config.dimensions;
}

EmbeddingConfig EmbeddingModule::getConfig() const {
	std::shared_lock lock(stateMutex_);
	return state_.config;
}

int EmbeddingModule::sanitizeDimensions(const std::string &provider, const std::string &model, int dimensions) {
	if (!isSupportedProviderModel(provider, model)) { return kDefaultDimensions; }
	if (dimensions < kMinDimensions || dimensions > kMaxDimensions) { return kDefaultDimensions; }
	return dimensions;
}

bool EmbeddingModule::isSupportedProviderModel(const std::string &provider, const std::string &model) {
	if (model != "jina-embeddings-v5-text-small") { return false; }

	std::string_view p = provider;
	p.remove_prefix(std::min(p.find_first_not_of(" \t\r\n\v\f"), p.size()));
	if (!p.empty()) { p.remove_suffix(p.size() - p.find_last_not_of(" \t\r\n\v\f") - 1); }

	return std::ranges::equal(p, std::string_view("jinaai"), [](char a, char b) {
		return std::tolower(static_cast<unsigned char>(a)) == b;
	});
}

std::vector<float> EmbeddingModule::generateEmbedding(const std::string &text, const std::string &task) {
	auto all = generateEmbeddings({text}, task);
	if (all.empty()) { return {}; }
	return std::move(all.front());
}

std::vector<std::vector<float>>
EmbeddingModule::generateEmbeddings(const std::vector<std::string> &texts, const std::string &task) {
	RuntimeState stateSnapshot;
	{
		std::shared_lock lock(stateMutex_);
		stateSnapshot = state_;
	}

	if (!stateSnapshot.isAvailable) {
		throw EmbeddingException(ERR_EMBEDDING_NOT_READY, "Embedding service unavailable", {});
	}
	if (!isSupportedProviderModel(stateSnapshot.config.provider, stateSnapshot.config.model)) {
		throw EmbeddingException(ERR_EMBEDDING_NOT_READY,
		                         "Unsupported embedding provider/model: " + stateSnapshot.config.provider + "/" +
		                             stateSnapshot.config.model,
		                         {});
	}

	validateTask(task);

	std::vector<std::string> filteredTexts;
	filteredTexts.reserve(texts.size());
	for (const auto &text : texts) {
		std::string_view sv = text;
		sv.remove_prefix(std::min(sv.find_first_not_of(" \t\r\n\v\f"), sv.size()));
		if (!sv.empty()) {
			sv.remove_suffix(sv.size() - sv.find_last_not_of(" \t\r\n\v\f") - 1);
		}

		if (sv.empty()) { continue; }
		filteredTexts.emplace_back(sv);
	}

	if (filteredTexts.empty()) { return {}; }

	const auto body    = buildRequestBody(stateSnapshot.config, filteredTexts, task);
	const auto headers = buildHeaders(stateSnapshot.config);

	EmbeddingError lastError;
	for (int attempt = 0; attempt <= std::max(0, stateSnapshot.config.maxRetries); ++attempt) {
		try {
			auto responseBody = stateSnapshot.httpClient->post(
			    stateSnapshot.config.apiUrl, headers, body, stateSnapshot.config.timeoutSeconds);
			nlohmann::json json;
			try {
				json = nlohmann::json::parse(responseBody);
			} catch (const nlohmann::json::exception &e) {
				throw EmbeddingException(ERR_EMBEDDING_FAILED,
				                         "Invalid embedding response JSON",
				                         makeError(200, "", std::string("Invalid embedding response JSON: ") + e.what(), false));
			}

			if (!json.contains("data") || !json["data"].is_array()) {
				throw EmbeddingException(ERR_EMBEDDING_FAILED,
				                         "Invalid embedding response: missing data array",
				                         makeError(200, "", "Invalid embedding response", false));
			}

			std::vector<std::vector<float>> results;
			results.resize(filteredTexts.size());

			for (const auto &item : json["data"]) {
				if (!item.is_object() || !item.contains("index") || !item.contains("embedding") ||
				    !item["embedding"].is_array()) {
					throw EmbeddingException(ERR_EMBEDDING_FAILED,
					                         "Invalid embedding response item",
					                         makeError(200, "", "Invalid embedding response item", false));
				}

				size_t index = item["index"].get<size_t>();
				if (index >= results.size()) {
					throw EmbeddingException(ERR_EMBEDDING_FAILED,
					                         "Invalid embedding response index",
					                         makeError(200, "", "Invalid embedding response index", false));
				}

				auto &vector = results[index];
				item["embedding"].get_to(vector);
			}

			for (const auto &vector : results) {
				if (vector.size() != static_cast<size_t>(stateSnapshot.config.dimensions)) {
					throw EmbeddingException(ERR_EMBEDDING_FAILED,
					                         "Embedding response dimension mismatch",
					                         makeError(200, "", "Embedding response dimension mismatch", false));
				}
			}

			return results;
		} catch (const EmbeddingException &e) {
			lastError = e.error();
			if (attempt >= stateSnapshot.config.maxRetries || !shouldRetry(lastError)) { throw; }
		} catch (const std::exception &e) {
			lastError = parseApiError(e);
			LOG_WARN("embedding",
			         "Embedding request attempt " + std::to_string(attempt + 1) + " failed: " + lastError.message);
			if (attempt >= stateSnapshot.config.maxRetries || !shouldRetry(lastError)) {
				throw EmbeddingException(ERR_EMBEDDING_FAILED, lastError.message, lastError);
			}
		}
	}

	throw EmbeddingException(ERR_EMBEDDING_FAILED, lastError.message.empty() ? "Embedding request failed" : lastError.message, lastError);
}

EmbeddingError EmbeddingModule::parseApiError(const std::exception &e) const {
	std::string message = e.what();
	// 静态生命周期，消除动态编译开销
	static const std::regex statusRegex(R"(returned\s+(\d+)\.\s+Body:\s+(.*)$)");
	std::smatch match;
	if (std::regex_search(message, match, statusRegex) && match.size() >= 3) {
		return parseApiError(std::stoi(match[1].str()), match[2].str());
	}
	if (message.find("timed out") != std::string::npos || message.find("timeout") != std::string::npos) {
		return makeError(504, "SERVICE_TIMEOUT", "Embedding request timed out", true);
	}
	if (dynamic_cast<const nlohmann::json::exception *>(&e) != nullptr) {
		return makeError(200, "", "Invalid embedding response JSON", false);
	}
	return makeError(0, "", message, false);
}

EmbeddingError EmbeddingModule::parseApiError(int statusCode, const std::string &body) const {
	std::string providerCode;
	std::string message = body;

	try {
		auto json = nlohmann::json::parse(body);
		if (json.contains("code") && json["code"].is_string()) { providerCode = json["code"].get<std::string>(); }
		if (json.contains("message") && json["message"].is_string()) {
			message = json["message"].get<std::string>();
		} else if (json.contains("detail") && json["detail"].is_string()) {
			message = json["detail"].get<std::string>();
		} else if (json.contains("error") && json["error"].is_object()) {
			const auto &error = json["error"];
			if (providerCode.empty() && error.contains("code") && error["code"].is_string()) {
				providerCode = error["code"].get<std::string>();
			}
			if (error.contains("message") && error["message"].is_string()) { message = error["message"].get<std::string>(); }
		}
	} catch (...) {}

	bool retryable = false;
	if (statusCode == 429 || statusCode == 500 || statusCode == 503 || statusCode == 504) { retryable = true; }

	if (providerCode == "AUTH_MISSING_API_KEY" || providerCode == "AUTH_INVALID_API_KEY" ||
	    providerCode == "AUTH_INVALID_FORMAT" || providerCode == "INPUT_MODEL_NOT_FOUND") {
		retryable = false;
	}

	return makeError(statusCode, providerCode, trimCopy(message), retryable);
}

bool EmbeddingModule::shouldRetry(const EmbeddingError &error) const {
	return error.retryable;
}

std::string EmbeddingModule::buildHeaders(const EmbeddingConfig &config) const {
	return "Authorization: Bearer " + config.apiKey + "\r\nContent-Type: application/json\r\n";
}

std::string EmbeddingModule::buildRequestBody(const EmbeddingConfig          &config,
                                              const std::vector<std::string> &texts,
                                              const std::string              &task) const {
	nlohmann::json body;
	body["model"]      = config.model;
	body["task"]       = task;
	body["dimensions"] = config.dimensions;
	body["truncate"]   = true;
	body["normalized"] = true;
	body["input"]      = texts;
	return body.dump();
}

void EmbeddingModule::validateTask(const std::string &task) const {
	if (task != "text-matching" && task != "retrieval.query") {
		throw EmbeddingException(ERR_INVALID_PARAMS,
		                         "Unsupported embedding task: " + task,
		                         makeError(0, "", "Unsupported embedding task", false));
	}
}

} // namespace quickmemes
