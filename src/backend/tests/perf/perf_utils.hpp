#pragma once

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace quickmemes::testing::perf {

struct PerfSample {
	std::string label;
	double      ms = 0.0;
};

struct PerfStats {
	void add(double ms) {
		add("sample_" + std::to_string(samplesMs.size()), ms);
	}

	void add(std::string label, double ms) {
		samplesMs.push_back(ms);
		samples_.push_back(PerfSample{std::move(label), ms});
	}

	void merge(const PerfStats &other) {
		samplesMs.insert(samplesMs.end(), other.samplesMs.begin(), other.samplesMs.end());
		samples_.insert(samples_.end(), other.samples_.begin(), other.samples_.end());
	}

	[[nodiscard]] double averageMs() const {
		if (samplesMs.empty()) { return 0.0; }
		double total = 0.0;
		for (double sample : samplesMs) { total += sample; }
		return total / static_cast<double>(samplesMs.size());
	}

	[[nodiscard]] double maxMs() const {
		if (samplesMs.empty()) { return 0.0; }
		return *std::max_element(samplesMs.begin(), samplesMs.end());
	}

	[[nodiscard]] double p95Ms() const {
		if (samplesMs.empty()) { return 0.0; }
		std::vector<double> sorted = samplesMs;
		std::sort(sorted.begin(), sorted.end());
		size_t index = static_cast<size_t>(std::ceil(static_cast<double>(sorted.size()) * 0.95)) - 1;
		if (index >= sorted.size()) { index = sorted.size() - 1; }
		return sorted[index];
	}

	[[nodiscard]] std::vector<PerfSample> topSlowestSamples(size_t count) const {
		if (count == 0 || samplesMs.empty()) { return {}; }
		std::vector<PerfSample> sorted = samples_;
		std::sort(sorted.begin(), sorted.end(), [](const PerfSample &lhs, const PerfSample &rhs) {
			return lhs.ms > rhs.ms;
		});
		if (sorted.size() > count) { sorted.resize(count); }
		return sorted;
	}

	[[nodiscard]] std::vector<double> topSlowestMs(size_t count) const {
		std::vector<double> values;
		for (const auto &sample : topSlowestSamples(count)) { values.push_back(sample.ms); }
		return values;
	}

	void print(const std::string &label, uint64_t seed, size_t sampleCount) const {
		const size_t totalSamples = samplesMs.size();
		const size_t topCount = std::min<size_t>(5, totalSamples);
		const auto topSlowest = topSlowestSamples(topCount);
		std::cout << "[perf] " << label << " seed=" << seed << " samples=" << sampleCount
		          << " collected=" << totalSamples
		          << " avg_ms=" << averageMs() << " p95_ms=" << p95Ms() << " max_ms=" << maxMs()
		          << " top_slowest_count=" << topCount << '\n';
		for (size_t i = 0; i < topSlowest.size(); ++i) {
			std::cout << "[perf][top_slowest] " << label << " rank=" << (i + 1)
			          << " sample_label=" << topSlowest[i].label << " ms=" << topSlowest[i].ms << '\n';
		}
	}

	std::vector<double> samplesMs;
	std::vector<PerfSample> samples_;
};

inline void printPerfNode(std::string_view group, size_t index, std::string_view label, double ms) {
	std::cout << "[perf][node] " << group << " index=" << (index + 1) << " label=" << label
	          << " ms=" << ms << '\n';
}

inline void printPerfTopSlowest(std::string_view group, const PerfStats &stats, size_t count = 5) {
	const auto topSlowest = stats.topSlowestSamples(count);
	std::cout << "[perf][top_slowest] " << group << " count=" << topSlowest.size() << '\n';
	for (size_t i = 0; i < topSlowest.size(); ++i) {
		std::cout << "[perf][top_slowest] " << group << " rank=" << (i + 1)
		          << " label=" << topSlowest[i].label << " ms=" << topSlowest[i].ms << '\n';
	}
}

template <typename Fn> [[nodiscard]] double measureMs(Fn &&fn) {
	auto start = std::chrono::steady_clock::now();
	fn();
	auto elapsed = std::chrono::steady_clock::now() - start;
	return std::chrono::duration<double, std::milli>(elapsed).count();
}

inline void writeTinyJpeg(const std::string &path) {
	std::filesystem::path filePath(path);
	if (!filePath.parent_path().empty()) {
		std::filesystem::create_directories(filePath.parent_path());
	}

	std::ofstream ofs(path, std::ios::binary);
	unsigned char data[] = {0xFF, 0xD8, 0xFF, 0xEE, 0x00, 0x0E, 0x41, 0x64, 0x6F, 0x62,
	                        0x65, 0x00, 0x64, 0x80, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9};
	ofs.write(reinterpret_cast<const char *>(data), sizeof(data));
}

} // namespace quickmemes::testing::perf
