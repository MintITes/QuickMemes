#include "core/server.hpp"

#include <memory>

// Unified global server instance for all tests
std::unique_ptr<quickmemes::Server> g_server = nullptr;
