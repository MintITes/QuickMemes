#pragma once
#include "core/router.hpp"

namespace quickmemes {

void handleGetHealth(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostImport(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostImportCancel(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemesSearch(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleGetMeme(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePutMeme(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemeUse(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemeOcr(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleGetMemeFile(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleGetMemeThumbnail(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostTags(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleGetTags(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleDeleteTag(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemeTags(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleDeleteMemeTags(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostExport(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemeRestore(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleDeleteTrashPurge(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleDeleteMeme(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePatchConfig(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleDeleteMemesBatch(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemesBatchTags(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleGetCategories(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostCategory(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePutCategory(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleDeleteCategory(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostMemesBatchCategory(const HttpRequestProxy &req, HttpResponseProxy &res);
void handleGetMemesTrash(const HttpRequestProxy &req, HttpResponseProxy &res);
void handlePostAdminRebuildEmbeddings(const HttpRequestProxy &req, HttpResponseProxy &res);

} // namespace quickmemes
