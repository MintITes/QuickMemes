cmake_minimum_required(VERSION 3.24)
project(QuickMemes-backend LANGUAGES CXX C)

if(POLICY CMP0174)
  cmake_policy(SET CMP0174 NEW)
endif()

if(WIN32 AND CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    message(STATUS "Enable bigobj for MinGW")
    add_compile_options(-Wa,-mbig-obj)
endif()

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ─────────────────────────────────────────────────────────────
# 外部依赖（FetchContent）
# ─────────────────────────────────────────────────────────────
include(FetchContent)

# ── Boost (Beast / Asio) ──
FetchContent_Declare(
    Boost
    URL https://github.com/boostorg/boost/releases/download/boost-1.90.0/boost-1.90.0-cmake.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
set(BOOST_INCLUDE_LIBRARIES beast asio uuid)
set(BUILD_SHARED_LIBS OFF)
FetchContent_MakeAvailable(Boost)

# ── nlohmann/json ──
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.12.0
    GIT_SHALLOW    TRUE
)
set(JSON_BuildTests OFF CACHE INTERNAL "")
FetchContent_MakeAvailable(nlohmann_json)

# ── SQLiteCpp (含 SQLite3 源码) ──
FetchContent_Declare(
    SQLiteCpp
    GIT_REPOSITORY https://github.com/SRombauts/SQLiteCpp.git
    GIT_TAG        3.3.3
    GIT_SHALLOW    TRUE
)
# 开启必要的 sqlite3 拓展，否则数据库创建 FTS5 和 Vector 表会失败
add_compile_definitions(SQLITE_ENABLE_FTS5=1 SQLITE_ENABLE_MATH_FUNCTIONS=1 SQLITE_ENABLE_COLUMN_METADATA=1)

set(SQLITECPP_RUN_CPPLINT OFF CACHE INTERNAL "")
set(SQLITECPP_RUN_CPPCHECK OFF CACHE INTERNAL "")
set(SQLITECPP_BUILD_EXAMPLES OFF CACHE INTERNAL "")
set(SQLITECPP_BUILD_TESTS OFF CACHE INTERNAL "")
FetchContent_MakeAvailable(SQLiteCpp)

# ── stb (header-only 图像库) ──
FetchContent_Declare(
    stb
    GIT_REPOSITORY https://github.com/nothings/stb.git
    GIT_TAG        master
    GIT_SHALLOW    TRUE
    CONFIGURE_COMMAND ""
    BUILD_COMMAND     ""
)
FetchContent_MakeAvailable(stb)

# ── sqlite-vec (向量搜索扩展) ──
FetchContent_Declare(
    sqlite_vec
    GIT_REPOSITORY https://github.com/asg017/sqlite-vec.git
    GIT_TAG        v0.1.6
    GIT_SHALLOW    TRUE
    CONFIGURE_COMMAND ""
    BUILD_COMMAND     ""
)
FetchContent_MakeAvailable(sqlite_vec)


if(NOT EXISTS "${sqlite_vec_SOURCE_DIR}/sqlite-vec.h")
    file(WRITE "${sqlite_vec_SOURCE_DIR}/sqlite-vec.h" "
#ifndef SQLITE_VEC_H\n#define SQLITE_VEC_H\n#ifndef SQLITE_CORE\n#include \"sqlite3ext.h\"\n#else\n#include \"sqlite3.h\"\n#endif\n#define SQLITE_VEC_API\n#define SQLITE_VEC_VERSION \"v0.1.6\"\n#define SQLITE_VEC_DATE \"2024-01-01\"\n#define SQLITE_VEC_SOURCE \"quickmemes\"\n#define SQLITE_VEC_VERSION_MAJOR 0\n#define SQLITE_VEC_VERSION_MINOR 1\n#define SQLITE_VEC_VERSION_PATCH 6\n#ifdef __cplusplus\nextern \"C\" {\n#endif\nSQLITE_VEC_API int sqlite3_vec_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi);\n#ifdef __cplusplus\n}\n#endif\n#endif\n")
endif()

# 查找 OpenSSL（SHA-256 和 HTTPS）
find_package(OpenSSL REQUIRED)

# ─────────────────────────────────────────────────────────────
# stb 实现库（需要一个 .cpp 文件来包含 stb 实现）
# ─────────────────────────────────────────────────────────────
set(STB_IMPL_FILE "${CMAKE_CURRENT_BINARY_DIR}/stb_impl.cpp")
file(WRITE ${STB_IMPL_FILE} [[
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_RESIZE_IMPLEMENTATION
#include "stb_image_resize2.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
]])
add_library(stb_impl STATIC ${STB_IMPL_FILE})
target_include_directories(stb_impl PUBLIC ${stb_SOURCE_DIR})

# ─────────────────────────────────────────────────────────────
# sqlite-vec 扩展编译为静态库
# 说明：Windows 下若编译为 DLL（SHARED）并同时静态链接 SQLiteCpp，
# 会导致 sqlite3 在不同模块中出现多个实例，进而在调用 sqlite3_vec_init()
# 时产生未定义行为（常见为 SEGFAULT）。使用静态库可保证同一 sqlite3 实例。
# ─────────────────────────────────────────────────────────────
add_library(sqlite_vec_ext STATIC ${sqlite_vec_SOURCE_DIR}/sqlite-vec.c)
target_include_directories(sqlite_vec_ext PRIVATE
    ${sqlite_vec_SOURCE_DIR}
    ${SQLiteCpp_SOURCE_DIR}/sqlite3  # SQLite3 头文件来自 SQLiteCpp 捆绑的 sqlite3
)
# 查找 SQLiteCpp 捆绑的 sqlite3.h 路径
target_include_directories(sqlite_vec_ext PRIVATE
    $<TARGET_PROPERTY:SQLiteCpp,INTERFACE_INCLUDE_DIRECTORIES>
)
target_compile_definitions(sqlite_vec_ext PRIVATE
    SQLITE_CORE
)
target_link_libraries(sqlite_vec_ext PRIVATE
    SQLiteCpp
)
set_target_properties(sqlite_vec_ext PROPERTIES
    OUTPUT_NAME "vec0"
)

# ─────────────────────────────────────────────────────────────
# 源代码子目录
# ─────────────────────────────────────────────────────────────
set(SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/src)
set(PCH_HEADER ${SRC_DIR}/pch.hpp)

# ── utils 静态库 ──
add_library(quickmemes_utils STATIC
    ${SRC_DIR}/utils/logger.cpp
    ${SRC_DIR}/utils/config_parser.cpp
    ${SRC_DIR}/utils/file_utils.cpp
)
target_include_directories(quickmemes_utils PUBLIC ${SRC_DIR})
target_link_libraries(quickmemes_utils PUBLIC
    nlohmann_json::nlohmann_json
    OpenSSL::Crypto
    stb_impl
)
target_precompile_headers(quickmemes_utils PRIVATE ${PCH_HEADER})

# ── db 静态库 ──
add_library(quickmemes_db STATIC
    ${SRC_DIR}/db/database.cpp
)
target_include_directories(quickmemes_db PUBLIC ${SRC_DIR})
target_link_libraries(quickmemes_db PUBLIC
    SQLiteCpp
    nlohmann_json::nlohmann_json
    quickmemes_utils
    sqlite_vec_ext
)
target_precompile_headers(quickmemes_db PRIVATE ${PCH_HEADER})

# ── vision 静态库 ──
add_library(quickmemes_vision STATIC
    ${SRC_DIR}/vision/vision.cpp
    ${SRC_DIR}/vision/http_client.cpp
)
target_include_directories(quickmemes_vision PUBLIC ${SRC_DIR})
target_link_libraries(quickmemes_vision PUBLIC
    Boost::beast
    Boost::asio
    nlohmann_json::nlohmann_json
    OpenSSL::SSL
    OpenSSL::Crypto
    quickmemes_utils
)
target_precompile_headers(quickmemes_vision PRIVATE ${PCH_HEADER})

# ── core 静态库 ──
add_library(quickmemes_core STATIC
    ${SRC_DIR}/core/server.cpp
    ${SRC_DIR}/core/router.cpp
    ${SRC_DIR}/core/handlers.cpp
    ${SRC_DIR}/core/task_queue.cpp
    ${SRC_DIR}/core/ws_pusher.cpp
)
target_include_directories(quickmemes_core PUBLIC ${SRC_DIR})
target_link_libraries(quickmemes_core PUBLIC
    Boost::beast
    Boost::asio
    Boost::uuid
    nlohmann_json::nlohmann_json
    quickmemes_db
    quickmemes_vision
    quickmemes_utils
)
if(WIN32)
    target_link_libraries(quickmemes_core PUBLIC
        ws2_32
        mswsock
    )
endif()

target_precompile_headers(quickmemes_core PRIVATE ${PCH_HEADER})

# ── 可执行文件 ──
add_executable(quickmemes-backend ${SRC_DIR}/main.cpp)
target_link_libraries(quickmemes-backend PRIVATE
    quickmemes_core
    quickmemes_db
    quickmemes_vision
    quickmemes_utils
)
target_precompile_headers(quickmemes-backend PRIVATE ${PCH_HEADER})

# ─────────────────────────────────────────────────────────────
# 测试
# ─────────────────────────────────────────────────────────────
option(BUILD_TESTING "Build test suite" ON)
if(BUILD_TESTING)
    enable_testing()
    add_subdirectory(tests)
endif()
