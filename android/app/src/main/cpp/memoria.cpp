#include <jni.h>
#include <cstdlib>
#include <atomic>
#include <algorithm>
#include <chrono>
#include <cstring>
#include <cstdint>

static volatile uint64_t sorvedouro;
using Relogio = std::chrono::steady_clock;
static double ns(Relogio::time_point inicio) { return std::chrono::duration<double, std::nano>(Relogio::now()-inicio).count(); }
static uint32_t padrao(int tipo,uint32_t i) {
    switch(tipo){case 0:return 0;case 1:return ~0u;case 2:return 0xaaaaaaaau;case 3:return 0x55555555u;case 4:return 1u<<(i&31);case 5:return i;case 6:{uint32_t x=i*1103515245u+12345u;return(x<<13)|(x>>19);}default:return ~i;}
}
extern "C" JNIEXPORT jlong JNICALL Java_br_com_smellsliketech_stresstest_MemoriaNativa_criarControle(JNIEnv*,jclass){return reinterpret_cast<jlong>(new std::atomic<bool>(false));}
extern "C" JNIEXPORT void JNICALL Java_br_com_smellsliketech_stresstest_MemoriaNativa_cancelarControle(JNIEnv*,jclass,jlong c){reinterpret_cast<std::atomic<bool>*>(c)->store(true);}
extern "C" JNIEXPORT void JNICALL Java_br_com_smellsliketech_stresstest_MemoriaNativa_fecharControle(JNIEnv*,jclass,jlong c){delete reinterpret_cast<std::atomic<bool>*>(c);}
extern "C" JNIEXPORT jdoubleArray JNICALL Java_br_com_smellsliketech_stresstest_MemoriaNativa_processarBloco(JNIEnv* env,jclass,jlong controle,jobject ba,jobject bb,jint tipo){
    auto* cancelar=reinterpret_cast<std::atomic<bool>*>(controle);
    auto* a=static_cast<uint32_t*>(env->GetDirectBufferAddress(ba));auto* b=static_cast<uint32_t*>(env->GetDirectBufferAddress(bb));
    const auto bytes=env->GetDirectBufferCapacity(ba);const size_t n=bytes/4;
    if(!a||!b||bytes<=0||env->GetDirectBufferCapacity(bb)!=bytes)return nullptr;
    auto inicio=Relogio::now();
    for(size_t i=0;i<n;i++){if((i&4095)==0&&cancelar->load())return nullptr;a[i]=padrao(tipo,i);}
    const double escrita=ns(inicio);uint64_t soma=0,erros=0;inicio=Relogio::now();
    for(size_t i=0;i<n;i++){if((i&4095)==0&&cancelar->load())return nullptr;const auto v=a[i];soma+=v;if(v!=padrao(tipo,i))erros++;}
    const double leitura=ns(inicio);sorvedouro=soma;inicio=Relogio::now();
    // Cópia em blocos para responder à parada sem esperar toda a alocação.
    for(size_t i=0;i<static_cast<size_t>(bytes);i+=65536){if(cancelar->load())return nullptr;std::memcpy(reinterpret_cast<char*>(b)+i,reinterpret_cast<char*>(a)+i,std::min<size_t>(65536,bytes-i));}
    const double copia=ns(inicio);
    for(size_t i=0;i<n;i++){if((i&4095)==0&&cancelar->load())return nullptr;if(b[i]!=padrao(tipo,i))erros++;}
    uint32_t pos=1;inicio=Relogio::now();for(int i=0;i<100000;i++){pos=((pos*1664525u+1013904223u)&0x7fffffffu)%n;soma+=a[pos];}sorvedouro=soma;
    const double valores[]={escrita,leitura,copia,ns(inicio)/100000,static_cast<double>(erros),static_cast<double>(bytes)*2};
    auto r=env->NewDoubleArray(6);if(r)env->SetDoubleArrayRegion(r,0,6,valores);return r;
}

// Blocos fora do heap ART; duração limitada ao worker que os possui.
extern "C" JNIEXPORT jobject JNICALL
Java_br_com_smellsliketech_stresstest_MemoriaNativa_alocarBloco(JNIEnv* env, jclass, jint bytes) {
    if (bytes <= 0) return nullptr;
    void* p = nullptr;
    if (posix_memalign(&p, 4096, static_cast<size_t>(bytes)) != 0) {
        env->ThrowNew(env->FindClass("java/lang/OutOfMemoryError"), "O sistema recusou o bloco nativo de memória.");
        return nullptr;
    }
    jobject buffer = env->NewDirectByteBuffer(p, bytes);
    if (buffer == nullptr) std::free(p);
    return buffer;
}
extern "C" JNIEXPORT void JNICALL
Java_br_com_smellsliketech_stresstest_MemoriaNativa_liberarBloco(JNIEnv* env, jclass, jobject buffer) {
    std::free(env->GetDirectBufferAddress(buffer));
}
