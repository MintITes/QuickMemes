cmake_minimum_required(VERSION 3.24)
project(QuickMemes-tests LANGUAGES CXX)

# 拉取 Googletest
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/releases/download/v1.17.0/googletest-1.17.0.tar.gz
)
# 全局开启 gtest_main，避免手写 main()
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# 包含 GoogleTest 配置
include(GoogleTest)

# 定义所有测试源文件
set(TEST_SOURCES
    core/test_router.cpp
    core/test_task_queue.cpp
    db/test_meme_crud.cpp
    db/test_tag_ops.cpp
    db/test_batch_ops.cpp
    db/test_search.cpp
    db/test_soft_delete.cpp
    db/test_category_ops.cpp
    vision/test_vision_mock.cpp
    utils/test_config_parser.cpp
    utils/test_logger.cpp
    integration/integration_test.cpp
    integration/test_security.cpp
    integration/test_ws_events.cpp
    core/test_handlers_extra.cpp
    core/test_concurrency_race.cpp
    db/test_last_used.cpp
    core/test_rebuild_embeddings.cpp
    core/test_config_api.cpp
    core/test_trash_purge.cpp
    core/test_task_queue_stress.cpp
    core/test_core_fixes.cpp
    test_globals.cpp
)

# 编译测试可执行文件
add_executable(quickmemes_tests ${TEST_SOURCES})

# 链接后端核心库和 GTest
target_link_libraries(quickmemes_tests PRIVATE
    quickmemes_core
    quickmemes_db
    quickmemes_vision
    quickmemes_utils
    gtest_main
    gmock
)

# 注册测试以供 CTest 运行
gtest_discover_tests(quickmemes_tests)
