package com.moath.thevault

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
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
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(Vo2MaxRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(PowerRecord::class),
        HealthPermission.getReadPermission(SpeedRecord::class),
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
    fun checkHealthPermissions(call: PluginCall) {
        scope.launch {
            try {
                val client = clientOrNull() ?: return@launch call.reject("Health Connect not available")
                val granted = withContext(Dispatchers.IO) {
                    client.permissionController.getGrantedPermissions()
                }
                val ret = JSObject()
                // Forgiving: proceed if the user granted at least one of our types.
                ret.put("granted", granted.any { it in permissions })
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message, e)
            }
        }
    }

    /** Shows the system Health Connect permission dialog. */
    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
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
                // Forgiving: proceed if the user granted at least one of our types.
                ret.put("granted", granted.any { it in permissions })
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject(e.message, e)
            }
        }
    }

    /**
     * Reads all selected metrics within a time window. Each type is read
     * independently (runCatching) so a missing type never fails the whole call.
     * Params: { startTime: epochMillis, endTime: epochMillis }
     * Cumulative types (calories/distance/exercise/steps) use [start,end];
     * instantaneous types (hr/oxygen/vo2/power/speed) take the latest/peak in
     * that window; sleep always looks back 36h from end to catch last night.
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
        val sleepRange = TimeRangeFilter.between(
            Instant.ofEpochMilli(endMs - 36L * 3600 * 1000),
            Instant.ofEpochMilli(endMs)
        )

        scope.launch {
            try {
                val client = clientOrNull() ?: return@launch call.reject("Health Connect not available")
                val ret = withContext(Dispatchers.IO) {
                    val out = JSObject()

                    runCatching {
                        val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, range))
                            .records.sumOf { it.count }
                        out.put("steps", steps)
                    }

                    runCatching {
                        val samples = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range))
                            .records.flatMap { it.samples }
                        val latest = samples.maxByOrNull { it.time }
                        val hr = JSObject()
                        if (latest != null) {
                            hr.put("latest", latest.beatsPerMinute)
                            hr.put("latestTime", latest.time.toString())
                        }
                        hr.put("samples", samples.size)
                        out.put("heartRate", hr)
                    }

                    runCatching {
                        val latest = client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, range))
                            .records.maxByOrNull { it.time }
                        val ox = JSObject()
                        if (latest != null) {
                            ox.put("latest", latest.percentage.value)
                            ox.put("latestTime", latest.time.toString())
                        }
                        out.put("oxygen", ox)
                    }

                    runCatching {
                        val sessions = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, sleepRange)).records
                        val arr = JSArray()
                        for (s in sessions) {
                            val o = JSObject()
                            o.put("start", s.startTime.toString())
                            o.put("end", s.endTime.toString())
                            o.put("minutes", Duration.between(s.startTime, s.endTime).toMinutes())
                            arr.put(o)
                        }
                        out.put("sleep", arr)
                    }

                    runCatching {
                        val kcal = client.readRecords(ReadRecordsRequest(TotalCaloriesBurnedRecord::class, range))
                            .records.sumOf { it.energy.inKilocalories }
                        out.put("calories", kcal)
                    }

                    runCatching {
                        val km = client.readRecords(ReadRecordsRequest(DistanceRecord::class, range))
                            .records.sumOf { it.distance.inKilometers }
                        out.put("distance", km)
                    }

                    runCatching {
                        val latest = client.readRecords(ReadRecordsRequest(Vo2MaxRecord::class, range))
                            .records.maxByOrNull { it.time }
                        if (latest != null) out.put("vo2max", latest.vo2MillilitersPerMinuteKilogram)
                    }

                    runCatching {
                        val sessions = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range)).records
                        val ex = JSObject()
                        ex.put("count", sessions.size)
                        ex.put("minutes", sessions.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() })
                        out.put("exercise", ex)
                    }

                    runCatching {
                        val maxW = client.readRecords(ReadRecordsRequest(PowerRecord::class, range))
                            .records.flatMap { it.samples }.maxByOrNull { it.power.inWatts }?.power?.inWatts
                        if (maxW != null) out.put("power", maxW)
                    }

                    runCatching {
                        val maxKmh = client.readRecords(ReadRecordsRequest(SpeedRecord::class, range))
                            .records.flatMap { it.samples }.maxByOrNull { it.speed.inKilometersPerHour }?.speed?.inKilometersPerHour
                        if (maxKmh != null) out.put("speed", maxKmh)
                    }

                    out
                }
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
