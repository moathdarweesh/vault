package com.moath.thevault

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant

/**
 * Reads steps, heart rate, blood-oxygen and sleep from Health Connect (which is
 * fed by Samsung Health / the Galaxy Watch). The JavaScript app calls these
 * methods through window.Capacitor.Plugins.HealthConnect — see js/health.js.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Every data type we want to read. Stress is intentionally absent — it is a
    // Samsung-proprietary type that Health Connect does not expose.
    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    private fun clientOrNull(): HealthConnectClient? {
        return if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }
    }

    /** Whether Health Connect is installed and usable on this device. */
    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val ret = JSObject()
        ret.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        ret.put("status", status) // 1=unavailable, 2=update required, 3=available
        call.resolve(ret)
    }

    /** True only when ALL of our read permissions have been granted. */
    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        scope.launch {
            try {
                val client = clientOrNull() ?: return@launch call.reject("Health Connect not available")
                val granted = withContext(Dispatchers.IO) {
                    client.permissionController.getGrantedPermissions()
                }
                val ret = JSObject()
                ret.put("granted", granted.containsAll(permissions))
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message, e)
            }
        }
    }

    /** Shows the system Health Connect permission dialog. */
    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        if (clientOrNull() == null) {
            call.reject("Health Connect not available")
            return
        }
        val contract = PermissionController.createRequestPermissionResultContract()
        val intent = contract.createIntent(context, permissions)
        startActivityForResult(call, intent, "permissionsCallback")
    }

    @ActivityCallback
    private fun permissionsCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                val client = clientOrNull() ?: return@launch call.reject("Health Connect not available")
                val granted = withContext(Dispatchers.IO) {
                    client.permissionController.getGrantedPermissions()
                }
                val ret = JSObject()
                ret.put("granted", granted.containsAll(permissions))
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message, e)
            }
        }
    }

    /**
     * Reads all four metrics within a time window.
     * Params: { startTime: epochMillis, endTime: epochMillis }
     * Returns: { steps, heartRate:{latest,latestTime,samples}, oxygen:{latest,latestTime}, sleep:[{start,end,minutes}] }
     */
    @PluginMethod
    fun readData(call: PluginCall) {
        val startMs = call.getLong("startTime")
        val endMs = call.getLong("endTime")
        if (startMs == null || endMs == null) {
            call.reject("startTime and endTime (epoch millis) are required")
            return
        }
        val range = TimeRangeFilter.between(Instant.ofEpochMilli(startMs), Instant.ofEpochMilli(endMs))

        scope.launch {
            try {
                val client = clientOrNull() ?: return@launch call.reject("Health Connect not available")
                val result = withContext(Dispatchers.IO) {
                    val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, range))
                        .records.sumOf { it.count }

                    val hrSamples = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range))
                        .records.flatMap { it.samples }
                    val latestHr = hrSamples.maxByOrNull { it.time }

                    val oxRecords = client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, range))
                        .records
                    val latestOx = oxRecords.maxByOrNull { it.time }

                    val sleepSessions = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range))
                        .records

                    Triple(steps, Pair(hrSamples.size, latestHr), Pair(latestOx, sleepSessions))
                }

                val (totalSteps, hrPair, oxSleep) = result
                val (hrCount, latestHr) = hrPair
                val (latestOx, sleepSessions) = oxSleep

                val ret = JSObject()
                ret.put("steps", totalSteps)

                val hr = JSObject()
                if (latestHr != null) {
                    hr.put("latest", latestHr.beatsPerMinute)
                    hr.put("latestTime", latestHr.time.toString())
                }
                hr.put("samples", hrCount)
                ret.put("heartRate", hr)

                val ox = JSObject()
                if (latestOx != null) {
                    ox.put("latest", latestOx.percentage.value)
                    ox.put("latestTime", latestOx.time.toString())
                }
                ret.put("oxygen", ox)

                val sleepArr = JSArray()
                for (s in sleepSessions) {
                    val o = JSObject()
                    o.put("start", s.startTime.toString())
                    o.put("end", s.endTime.toString())
                    o.put("minutes", Duration.between(s.startTime, s.endTime).toMinutes())
                    sleepArr.put(o)
                }
                ret.put("sleep", sleepArr)

                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message, e)
            }
        }
    }

    /** Opens the Health Connect app so the user can manage permissions/data. */
    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        try {
            val intent = android.content.Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message, e)
        }
    }
}
