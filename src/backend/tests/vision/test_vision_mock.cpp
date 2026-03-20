/**
 * @file test_vision_mock.cpp
 * @brief Vision 模块 HTTP 阻断与 Mock 响应测试
 */

#include "../mocks.hpp"
#include "../test_utils.hpp"
#include "utils/logger.hpp"
#include "vision/vision.hpp"

#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <gtest/gtest.h>
#include <vector>

using ::testing::_;
using ::testing::HasSubstr;
using ::testing::NiceMock;
using ::testing::Return;

namespace quickmemes { namespace testing {

namespace {

std::filesystem::path testsRootPath() {
	return std::filesystem::path(__FILE__).parent_path().parent_path();
}

std::string readTestEnvValue(const std::string &key) {
	std::ifstream ifs(testsRootPath() / ".test_env");
	if (!ifs.is_open()) { return ""; }

	std::string line;
	while (std::getline(ifs, line)) {
		if (line.empty() || line[0] == '#') { continue; }
		auto eqPos = line.find('=');
		if (eqPos == std::string::npos) { continue; }
		if (line.substr(0, eqPos) != key) { continue; }

		auto value = line.substr(eqPos + 1);
		while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front()))) {
			value.erase(value.begin());
		}
		while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back()))) {
			value.pop_back();
		}
		if (value.size() >= 2 &&
		    ((value.front() == '"' && value.back() == '"') || (value.front() == '\'' && value.back() == '\''))) {
			value = value.substr(1, value.size() - 2);
		}
		return value;
	}
	return "";
}

std::string makeGifStubPath(const std::filesystem::path &dir, const std::string &name) {
	auto                path = dir / name;
	std::ofstream       ofs(path, std::ios::binary);
	const unsigned char bytes[] = {'G',  'I',  'F',  '8',  '9',  'a',  0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
	                               0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
	                               0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B};
	ofs.write(reinterpret_cast<const char *>(bytes), sizeof(bytes));
	return path.string();
}

std::string makePpmStubPath(const std::filesystem::path &dir, const std::string &name) {
	auto          path = dir / name;
	std::ofstream ofs(path, std::ios::binary);
	ofs << "P6\n1 1\n255\n";
	const unsigned char pixel[] = {255, 255, 255};
	ofs.write(reinterpret_cast<const char *>(pixel), sizeof(pixel));
	return path.string();
}

std::string makeLargeNoisyPpmPath(const std::filesystem::path &dir, const std::string &name) {
	const int     width  = 700;
	const int     height = 700;
	auto          path   = dir / name;
	std::ofstream ofs(path, std::ios::binary);
	ofs << "P6\n" << width << ' ' << height << "\n255\n";
	std::vector<unsigned char> pixels(width * height * 3);
	for (int y = 0; y < height; ++y) {
		for (int x = 0; x < width; ++x) {
			size_t idx      = static_cast<size_t>(y * width + x) * 3;
			pixels[idx]     = static_cast<unsigned char>((x * 37 + y * 17) % 256);
			pixels[idx + 1] = static_cast<unsigned char>((x * 13 + y * 29) % 256);
			pixels[idx + 2] = static_cast<unsigned char>((x * 7 + y * 19) % 256);
		}
	}
	ofs.write(reinterpret_cast<const char *>(pixels.data()), static_cast<std::streamsize>(pixels.size()));
	return path.string();
}

std::string makePaddleOcrSuccessResponse(const std::vector<std::vector<std::string>> &pages) {
	nlohmann::json json;
	json["logId"]                = "abc";
	json["errorCode"]            = 0;
	json["errorMsg"]             = "Success";
	json["result"]["ocrResults"] = nlohmann::json::array();

	for (const auto &page : pages) {
		nlohmann::json item;
		item["prunedResult"]["res"]["rec_texts"] = page;
		json["result"]["ocrResults"].push_back(item);
	}

	return json.dump();
}

std::filesystem::path sampleImagePath() {
	auto repoRoot =
	    std::filesystem::path(__FILE__).parent_path().parent_path().parent_path().parent_path().parent_path();
	return repoRoot / "resources" / "QuickMemes_logo_Dark.png";
}

} // namespace

class VisionMockTest : public ::testing::Test {
protected:
	void SetUp() override {
		mockHttp = std::make_shared<NiceMock<MockHttpClient>>();
		vision   = std::make_unique<VisionModule>(mockHttp);
		tempDir_ = std::make_unique<TestDirectory>();

		VisionConfig config;
		config.apiKey         = "test_key";
		config.apiBaseUrl     = "https://api.test.com";
		config.visionModel    = "test-vision";
		config.embeddingModel = "test-embed";
		config.ocrProvider    = "PaddleOCR";
		config.ocrApiKey      = "test-ocr-key";
		config.ocrApiUrl      = "https://ocr.example.com";

		// Create dummy image to satisfy stbi_load
		dummyPath = tempDir_->getSubPath("dummy.jpg");
		std::ofstream ofs(dummyPath, std::ios::binary);
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

		ON_CALL(*mockHttp, get(_, _, _)).WillByDefault(Return("ok"));
		ON_CALL(*mockHttp, post(_, _, _, _))
		    .WillByDefault(Return(R"({"data":[{"embedding":[0.1]}], "usage": {"total_tokens": 1}})"));

		vision->initialize(config);
	}

	void TearDown() override {
		tempDir_.reset();
	}

	std::shared_ptr<NiceMock<MockHttpClient>> mockHttp;
	std::unique_ptr<VisionModule>             vision;
	std::unique_ptr<TestDirectory>            tempDir_;
	std::string                               dummyPath;
};

TEST_F(VisionMockTest, AnalyzeImage_ValidMockResponse_ReturnsResult) {
	std::string mockResponse =
	    R"({"choices":[{"message":{"content":"{\"description\": \"A funny cat meme\", \"tags\": [\"cat\", \"funny\"]}"}}], "usage": {"total_tokens": 100}})";
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(mockResponse));

	auto result = vision->analyzeImage(dummyPath, "text");
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.description, "A funny cat meme");
}

TEST_F(VisionMockTest, Recognize_PaddleOCR_RequestAndParse_Succeeds) {
	auto mockResponse = makePaddleOcrSuccessResponse({
	    {"hello world", "second line"}
    });

	EXPECT_CALL(*mockHttp,
	            post("https://ocr.example.com/ocr",
	                 HasSubstr("Authorization: token test-ocr-key"),
	                 ::testing::AllOf(HasSubstr("\"fileType\":1"),
	                                  HasSubstr("\"useDocOrientationClassify\":false"),
	                                  HasSubstr("\"useDocUnwarping\":false"),
	                                  HasSubstr("\"useTextlineOrientation\":false"),
	                                  HasSubstr("\"visualize\":false")),
	                 _))
	    .WillOnce(Return(mockResponse));

	auto result = vision->recognize(dummyPath);
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.fullText, "hello world\nsecond line");
	EXPECT_TRUE(result.error.empty());
}

TEST_F(VisionMockTest, Recognize_PaddleOCR_MultiPageResults_JoinInOrder) {
	auto mockResponse = makePaddleOcrSuccessResponse({
	    {"page1 line1", "page1 line2"},
	    {"page2 line1"}
    });
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(mockResponse));

	auto result = vision->recognize(dummyPath);
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.fullText, "page1 line1\npage1 line2\npage2 line1");
}

TEST_F(VisionMockTest, Recognize_GifInput_SkipsNetworkCall) {
	auto gifPath = makeGifStubPath(tempDir_->getPath(), "skip.gif");

	EXPECT_CALL(*mockHttp, post(_, _, _, _)).Times(0);

	auto result = vision->recognize(gifPath);
	EXPECT_TRUE(result.success);
	EXPECT_TRUE(result.fullText.empty());
	EXPECT_TRUE(result.error.empty());
}

TEST_F(VisionMockTest, Recognize_StaticImage_ConvertsToJpegPayload) {
	auto ppmPath = makePpmStubPath(tempDir_->getPath(), "sample.ppm");

	EXPECT_CALL(*mockHttp,
	            post("https://ocr.example.com/ocr",
	                 HasSubstr("Authorization: token test-ocr-key"),
	                 ::testing::AllOf(HasSubstr("\"fileType\":1"), HasSubstr("\"file\":\"")),
	                 _))
	    .WillOnce(Return(makePaddleOcrSuccessResponse({{"ok"}})));

	auto result = vision->recognize(ppmPath);
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.fullText, "ok");
}

TEST_F(VisionMockTest, Recognize_LargeStaticImage_StillSucceedsAfterCompression) {
	auto ppmPath = makeLargeNoisyPpmPath(tempDir_->getPath(), "large.ppm");
	ASSERT_GT(std::filesystem::file_size(ppmPath), 1024 * 1024);

	EXPECT_CALL(*mockHttp,
	            post("https://ocr.example.com/ocr",
	                 HasSubstr("Authorization: token test-ocr-key"),
	                 HasSubstr("\"file\":\""),
	                 _))
	    .WillOnce(Return(makePaddleOcrSuccessResponse({{"big"}})));

	auto result = vision->recognize(ppmPath);
	EXPECT_TRUE(result.success);
	EXPECT_EQ(result.fullText, "big");
}

TEST_F(VisionMockTest, Recognize_PaddleOCR_ErrorResponse_ReturnsFailure) {
	EXPECT_CALL(*mockHttp, post(_, _, _, _)).WillOnce(Return(R"({"errorCode":403,"errorMsg":"Token 错误"})"));

	auto result = vision->recognize(dummyPath);
	EXPECT_FALSE(result.success);
	EXPECT_THAT(result.error, HasSubstr("Token 错误"));
}

TEST_F(VisionMockTest, Recognize_UnsupportedProvider_ReturnsFailure) {
	VisionConfig config;
	config.apiKey         = "test_key";
	config.apiBaseUrl     = "https://api.test.com";
	config.visionModel    = "test-vision";
	config.embeddingModel = "test-embed";
	config.ocrProvider    = "legacy";
	config.ocrApiKey      = "test-ocr-key";
	config.ocrApiUrl      = "https://ocr.example.com";
	vision->reconfigure(config);

	EXPECT_CALL(*mockHttp, post(_, _, _, _)).Times(0);

	auto result = vision->recognize(dummyPath);
	EXPECT_FALSE(result.success);
	EXPECT_THAT(result.error, HasSubstr("Unsupported OCR provider"));
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
	GTEST_SKIP() << "Placeholder test replaced by PaddleOCR coverage.";
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

TEST(PaddleOcrLiveTest, Recognize_WithRealKey_UsesDotEnvAndReturnsText) {
	if (std::getenv("QM_RUN_PADDLEOCR_LIVE") == nullptr) {
		GTEST_SKIP() << "Set QM_RUN_PADDLEOCR_LIVE=1 to enable the live PaddleOCR test";
	}

	auto apiKey = readTestEnvValue("ocr-pp_ocr-key");
	auto apiUrl = readTestEnvValue("ocr-pp_ocr-url");
	if (apiKey.empty()) { GTEST_SKIP() << "No PaddleOCR API key found in src/backend/tests/.test_env"; }
	if (apiUrl.empty()) { GTEST_SKIP() << "No PaddleOCR API url found in src/backend/tests/.test_env"; }

	auto imagePath = sampleImagePath();
	if (!std::filesystem::exists(imagePath)) {
		GTEST_SKIP() << "Local PaddleOCR sample image not found: " << imagePath.string();
	}

	VisionModule vision;
	VisionConfig config;
	config.ocrProvider    = "PaddleOCR";
	config.ocrApiKey      = apiKey;
	config.ocrApiUrl      = apiUrl;
	config.timeoutSeconds = 10;
	config.maxRetries     = 0;

	vision.initialize(config);

	auto result = vision.recognize(imagePath.string());
	LOG_INFO("vision", "PaddleOCR live result:\n" + result.fullText);
	EXPECT_TRUE(result.success) << result.error;
	EXPECT_FALSE(result.fullText.empty());
}

}} // namespace quickmemes::testing
