package com.pulsesdk.util

import java.security.MessageDigest

internal object VariantAssigner {

    fun assign(userId: String, experimentId: String, variants: List<Pair<String, Int>>): String? {
        if (variants.isEmpty()) return null

        val input = "$userId$experimentId"
        val hash = md5(input)
        val bucket = (hash.toLong(16) and 0x7FFFFFFF) % 100

        var cumulative = 0
        for ((variantId, weight) in variants) {
            cumulative += weight
            if (bucket < cumulative) return variantId
        }

        return variants.last().first
    }

    private fun md5(input: String): String {
        val bytes = MessageDigest.getInstance("MD5").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }.take(8)
    }
}