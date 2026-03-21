/**
 * @file embedding.cpp
 * @brief Embedding 模块实现
 */

#include "embedding/embedding.hpp"

#include "utils/logger.hpp"

#include <algorithm>
#include <cctype>
#include <nlohmann/json.hpp>
#include <regex>
#include <sstream>

namespace quickmemes {

namespace {

std::string toLowerCopy(std::string value) {
	std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
		return static_cast<char>(std::tolower(c));
	});
	return value;
}

std::string trimCopy(std::string value) {
	auto notSpace = [](unsigned char ch) { return !std::isspace(ch); };
	value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
	value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(), value.end());
	return value;
}

std::string normalizeProvider(const std::string &provider) {
	return toLowerCopy(trimCopy(provider));
}

bool isBlankText(const std::string &value) {
	return std::all_of(value.begin(), value.end(), [](unsigned char ch) { return std::isspace(ch); });
}

EmbeddingError makeError(int statusCode, std::string providerCode, std::string message, bool retryable) {
	return {statusCode, std::move(providerCode), std::move(message), retryable};
}

} // namespace

EmbeddingModule::EmbeddingModule(std::shared_ptr<HttpClientInterface> httpClient)
    : httpClient_(std::move(httpClient)) {}

EmbeddingModule::~EmbeddingModule() = default;

bool EmbeddingModule::initialize(const EmbeddingConfig &config) {
	config_            = config;
	config_.dimensions = sanitizeDimensions(config.provider, config.model, config.dimensions);
	isAvailable_       = !config_.apiKey.empty() && !config_.apiUrl.empty() &&
	               isSupportedProviderModel(config_.provider, config_.model);

	if (!isAvailable_) {
		LOG_WARN("embedding",
		         "Embedding unavailable. provider=" + config_.provider + ", model=" + config_.model +
		             ", apiUrl configured=" + std::string(config_.apiUrl.empty() ? "false" : "true") +
		             ", apiKey configured=" + std::string(config_.apiKey.empty() ? "false" : "true"));
	} else {
		LOG_INFO("embedding",
		         "EmbeddingModule initialized. provider=" + config_.provider + ", model=" + config_.model +
		             ", dimensions=" + std::to_string(config_.dimensions));
	}

	return isAvailable_;
}

void EmbeddingModule::shutdown() {
	isAvailable_ = false;
	LOG_INFO("embedding", "EmbeddingModule shutdown.");
}

bool EmbeddingModule::reconfigure(const EmbeddingConfig &config) {
	return initialize(config);
}

bool EmbeddingModule::isAvailable() const {
	return isAvailable_;
}

int EmbeddingModule::getDimensions() const {
	return config_.dimensions;
}

const EmbeddingConfig &EmbeddingModule::getConfig() const {
	return config_;
}

int EmbeddingModule::sanitizeDimensions(const std::string &provider, const std::string &model, int dimensions) {
	if (!isSupportedProviderModel(provider, model)) { return kDefaultDimensions; }
	if (dimensions < kMinDimensions || dimensions > kMaxDimensions) { return kDefaultDimensions; }
	return dimensions;
}

bool EmbeddingModule::isSupportedProviderModel(const std::string &provider, const std::string &model) {
	return normalizeProvider(provider) == "jinaai" && model == "jina-embeddings-v5-text-small";
}

std::vector<float> EmbeddingModule::generateEmbedding(const std::string &text, const std::string &task) {
	auto all = generateEmbeddings({text}, task);
	if (all.empty()) { return {}; }
	return std::move(all.front());
}

std::vector<std::vector<float>>
EmbeddingModule::generateEmbeddings(const std::vector<std::string> &texts, const std::string &task) {
	if (!isAvailable_) { throw EmbeddingException(ERR_EMBEDDING_NOT_READY, "Embedding service unavailable", {}); }
	if (!isSupportedProviderModel(config_.provider, config_.model)) {
		throw EmbeddingException(ERR_EMBEDDING_NOT_READY,
		                         "Unsupported embedding provider/model: " + config_.provider + "/" + config_.model,
		                         {});
	}

	validateTask(task);

	std::vector<std::string> filteredTexts;
	filteredTexts.reserve(texts.size());
	for (const auto &text : texts) {
		auto trimmed = trimCopy(text);
		if (trimmed.empty() || isBlankText(trimmed)) { continue; }
		filteredTexts.push_back(trimmed);
	}

	if (filteredTexts.empty()) { return {}; }

	const auto body    = buildRequestBody(filteredTexts, task);
	const auto headers = buildHeaders();

	EmbeddingError lastError;
	for (int attempt = 0; attempt <= std::max(0, config_.maxRetries); ++attempt) {
		try {
			auto responseBody = httpClient_->post(config_.apiUrl, headers, body, config_.timeoutSeconds);
			auto json         = nlohmann::json::parse(responseBody);

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
				vector.reserve(item["embedding"].size());
				for (const auto &value : item["embedding"]) {
					vector.push_back(value.get<float>());
				}
			}

			for (const auto &vector : results) {
				if (vector.size() != static_cast<size_t>(config_.dimensions)) {
					throw EmbeddingException(ERR_EMBEDDING_FAILED,
					                         "Embedding response dimension mismatch",
					                         makeError(200, "", "Embedding response dimension mismatch", false));
				}
			}

			return results;
		} catch (const EmbeddingException &e) {
			lastError = e.error();
			if (attempt >= config_.maxRetries || !shouldRetry(lastError)) { throw; }
		} catch (const std::exception &e) {
			lastError = parseApiError(e);
			LOG_WARN("embedding",
			         "Embedding request attempt " + std::to_string(attempt + 1) + " failed: " + lastError.message);
			if (attempt >= config_.maxRetries || !shouldRetry(lastError)) {
				throw EmbeddingException(ERR_EMBEDDING_FAILED, lastError.message, lastError);
			}
		}
	}

	throw EmbeddingException(ERR_EMBEDDING_FAILED, lastError.message.empty() ? "Embedding request failed" : lastError.message, lastError);
}

EmbeddingError EmbeddingModule::parseApiError(const std::exception &e) const {
	std::string message = e.what();
	std::regex  statusRegex(R"(returned\s+(\d+)\.\s+Body:\s+(.*)$)");
	std::smatch match;
	if (std::regex_search(message, match, statusRegex) && match.size() >= 3) {
		return parseApiError(std::stoi(match[1].str()), match[2].str());
	}
	if (message.find("timed out") != std::string::npos || message.find("timeout") != std::string::npos) {
		return makeError(504, "SERVICE_TIMEOUT", "Embedding request timed out", true);
	}
	return makeError(0, "", message, true);
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

std::string EmbeddingModule::buildHeaders() const {
	return "Authorization: Bearer " + config_.apiKey + "\r\nContent-Type: application/json\r\n";
}

std::string EmbeddingModule::buildRequestBody(const std::vector<std::string> &texts, const std::string &task) const {
	nlohmann::json body;
	body["model"]      = config_.model;
	body["task"]       = task;
	body["dimensions"] = config_.dimensions;
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
