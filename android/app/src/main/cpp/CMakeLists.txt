cmake_minimum_required(VERSION 3.22.1)
project(slt_memoria LANGUAGES CXX)
add_library(slt_memoria SHARED memoria.cpp)
target_compile_features(slt_memoria PRIVATE cxx_std_17)
target_compile_options(slt_memoria PRIVATE -O2)
# NDK r27: LOAD e RELRO compatíveis com kernels Android de 4 KB e 16 KB.
target_link_options(slt_memoria PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,-z,common-page-size=16384")
