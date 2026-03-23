#pragma once

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

namespace quickmemes::testing::perf {

struct PerfStats {
	void add(double ms) { samplesMs.push_back(ms); }

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

	void print(const std::string &label, uint64_t seed, size_t sampleCount) const {
		std::cout << "[perf] " << label << " seed=" << seed << " samples=" << sampleCount
		          << " avg_ms=" << averageMs() << " p95_ms=" << p95Ms() << " max_ms=" << maxMs() << '\n';
	}

	std::vector<double> samplesMs;
};

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
