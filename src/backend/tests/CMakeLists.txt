cmake_minimum_required(VERSION 3.24)
project(QuickMemes-tests LANGUAGES CXX)

if(POLICY CMP0174)
  cmake_policy(SET CMP0174 NEW)
endif()

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

# 定义普通测试源文件
set(TEST_SOURCES
    core/test_router.cpp
    core/test_task_queue.cpp
    db/test_meme_crud.cpp
    db/test_tag_ops.cpp
    db/test_batch_ops.cpp
    db/test_search.cpp
    db/test_soft_delete.cpp
    db/test_category_ops.cpp
    db/test_backup_restore.cpp
    vision/test_vision_mock.cpp
    embedding/test_embedding_mock.cpp
    utils/test_config_parser.cpp
    utils/test_file_utils.cpp
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
    core/test_server_lifecycle.cpp
    core/test_main_entry.cpp
    vision/test_http_client.cpp
    test_globals.cpp
)

# 定义性能测试源文件
set(PERF_TEST_SOURCES
    core/test_import_perf.cpp
    core/test_hot_path_perf.cpp
    db/test_search_perf.cpp
)

# 编译测试可执行文件
add_executable(quickmemes_tests ${TEST_SOURCES})

# 编译性能测试可执行文件
add_executable(quickmemes_perf_tests ${PERF_TEST_SOURCES})

# 链接后端核心库和 GTest
target_link_libraries(quickmemes_tests PRIVATE
    quickmemes_core
    quickmemes_db
    quickmemes_embedding
    quickmemes_vision
    quickmemes_utils
    gtest_main
    gmock
)

target_link_libraries(quickmemes_perf_tests PRIVATE
    quickmemes_core
    quickmemes_db
    quickmemes_embedding
    quickmemes_vision
    quickmemes_utils
    gtest_main
    gmock
)
# 使用后端共享 PCH（避免重复编译常用头）
set(PCH_HEADER ${CMAKE_CURRENT_LIST_DIR}/../src/pch.hpp)
target_precompile_headers(quickmemes_tests PRIVATE ${PCH_HEADER})
target_precompile_headers(quickmemes_perf_tests PRIVATE ${PCH_HEADER})

if(MSVC)
    add_custom_command(TARGET quickmemes_tests POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_RUNTIME_DLLS:quickmemes_tests>
        $<TARGET_FILE_DIR:quickmemes_tests>
        COMMAND_EXPAND_LISTS
    )
    add_custom_command(TARGET quickmemes_perf_tests POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_RUNTIME_DLLS:quickmemes_perf_tests>
        $<TARGET_FILE_DIR:quickmemes_perf_tests>
        COMMAND_EXPAND_LISTS
    )
endif()

# 注册测试以供 CTest 运行
gtest_discover_tests(
    quickmemes_tests
    DISCOVERY_MODE PRE_TEST
)

gtest_discover_tests(
    quickmemes_perf_tests
    DISCOVERY_MODE PRE_TEST
    PROPERTIES LABELS perf
)
