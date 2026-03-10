/**
 * @file test_vision_mock.cpp
 * @brief Vision 模块 HTTP 阻断与 Mock 响应测试
 */

#include "../mocks.hpp"
#include "vision/vision.hpp"

#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include "../test_utils.hpp"

using ::testing::_;
using ::testing::Return;

namespace quickmemes {
namespace testing {

class VisionMockTest : public ::testing::Test {
protected:
	void SetUp() override {
		mockHttp = std::make_shared<MockHttpClient>();
		vision   = std::make_unique<VisionModule>(mockHttp);
		tempDir_ = std::make_unique<TestDirectory>();

		VisionConfig config;
		config.apiKey         = "test_key";
		config.apiBaseUrl     = "https://api.test.com";
		config.visionModel    = "test-vision";
		config.embeddingModel = "test-embed";
		config.ocrProvider    = "test-ocr";
		config.ocrApiKey      = "test-ocr-key";
		config.ocrApiUrl      = "https://ocr.test.com";

		// Create dummy image to satisfy stbi_load
		dummyPath = tempDir_->getSubPath("dummy.jpg");
		std::ofstream ofs(dummyPath, std::ios::binary);
		// Minimal 1x1 white JPEG stub
		unsigned char data[] = {
		    0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
		    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F,
		    0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
		    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF,
		    0xDB, 0x00, 0x43, 0x01, 0x09, 0x09, 0x09, 0x0C, 0x0B, 0x0C, 0x18, 0x0D, 0x0D, 0x18, 0x32, 0x21, 0x1C, 0x21,
		    0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32,
		    0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32,
		    0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0xFF, 0xC0, 0x00, 0x11,
		    0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00,
		    0x15, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		    0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		    0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x11, 0x01, 0x00, 0x00, 0x00,
		    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03,
		    0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x00, 0x94, 0x80, 0x01, 0xFF, 0xD9};
		ofs.write(reinterpret_cast<const char *>(data), sizeof(data));
		ofs.close();

		// Mock the probe call during initialize
		EXPECT_CALL(*mockHttp, get(_, _, _)).WillRepeatedly(Return("ok"));
		// Mock the embedding probe
		std::string embedProbe = R"({"data":[{"embedding":[0.1]}], "usage": {"total_tokens": 1}})";
		EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillRepeatedly(Return(embedProbe));

		vision->initialize(config);
	}

	void TearDown() override { tempDir_.reset(); }

	std::shared_ptr<MockHttpClient> mockHttp;
	std::unique_ptr<VisionModule> vision;
	std::unique_ptr<TestDirectory> tempDir_;
	std::string dummyPath;
};

TEST_F(VisionMockTest, AnalyzeImage_ValidMockResponse_ReturnsResult) {
	std::string mockResponse =
	    R"({"choices":[{"message":{"content":"{\"description\": \"A funny cat meme\", \"tags\": [\"cat\", \"funny\"]}"}}], "usage": {"total_tokens": 100}})";
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(mockResponse));

	auto result = vision->analyzeImage(dummyPath, "text");
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.description, "A funny cat meme");
}

TEST_F(VisionMockTest, AnalyzeImage_HttpTimeout_ThrowsException) {
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillRepeatedly(::testing::Throw(ApiException(ERR_INTERNAL, "Timeout")));

	auto result = vision->analyzeImage(dummyPath, "text");
	EXPECT_FALSE(result.success);
}

TEST_F(VisionMockTest, GenerateEmbedding_ValidMockResponse_ReturnsVector) {
	std::string mockResponse = R"({"data":[{"embedding":[0.1, 0.2, 0.3]}], "usage": {"total_tokens": 50}})";
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(mockResponse));

	auto vec = vision->generateEmbedding("some text");
	EXPECT_EQ(vec.size(), 3);
	EXPECT_FLOAT_EQ(vec[0], 0.1f);
}

TEST_F(VisionMockTest, AnalyzeImage_MultipleTagsAndOcr_CorrectParsing) {
	std::string mockResponse =
	    R"({"choices":[{"message":{"content":"{\"description\": \"Multiple tags test\", \"tags\": [\"t1\", \"t2\", \"t3\"], \"ocr_text\": \"Extracted text\"}"}}], "usage": {"total_tokens": 120}})";
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(mockResponse));

	auto result = vision->analyzeImage(dummyPath, "text");
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.description, "Multiple tags test");
	EXPECT_EQ(result.suggestedTags.size(), 3);
	EXPECT_EQ(result.suggestedTags[0], "t1");
}

TEST_F(VisionMockTest, Recognize_Placeholder_ReturnsFixedText) {
	auto result = vision->recognize(dummyPath);
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.fullText, "OCR Extraction Placeholder");
}

TEST_F(VisionMockTest, AnalyzeImage_MissingTagsInJson_ParsesDescriptionOnly) {
	std::string mockResponse =
	    R"({"choices":[{"message":{"content":"{\"description\": \"Only desc\"}"}}], "usage": {"total_tokens": 50}})";
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(mockResponse));

	auto result = vision->analyzeImage(dummyPath, "text");
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.description, "Only desc");
	EXPECT_TRUE(result.suggestedTags.empty());
}

TEST_F(VisionMockTest, AnalyzeImage_ApiHttp500_ReturnsFailure) {
	EXPECT_CALL(*mockHttp, post(_, _, _, _))
	    .WillRepeatedly(::testing::Throw(ApiException(ERR_INTERNAL, "Internal Server Error")));

	auto result = vision->analyzeImage(dummyPath, "text");
	EXPECT_FALSE(result.success);
	EXPECT_EQ(result.error, "Internal Server Error");
}

} // namespace testing
} // namespace quickmemes
