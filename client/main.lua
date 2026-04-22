-- client/main.lua

local isVisible = false

Citizen.CreateThread(function()
    while true do
        local sleep = 500
        local playerPed = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(playerPed, false)

        if vehicle ~= 0 and GetPedInVehicleSeat(vehicle, -1) == playerPed then
            sleep = 50 -- Update UI at 20Hz (or higher if needed)
            
            if not isVisible then
                isVisible = true
                SendNUIMessage({ type = 'show' })
            end

            -- Get Data from spz-physics
            local rpm = exports["spz-physics"]:GetCurrentRPM()
            local rpmData = exports["spz-physics"]:GetMinMaxRPM()
            local telemetry = exports["spz-physics"]:GetTelemetry()
            
            -- Fallback for max RPM if physics not ready
            local maxRpm = rpmData.max or 7000
            
            -- Speed in KM/H
            local speed = math.floor(GetEntitySpeed(vehicle) * 3.6)
            
            -- Gear
            local gear = GetVehicleCurrentGear(vehicle)

            -- Send to NUI
            SendNUIMessage({
                type = 'update',
                speed = speed,
                gear = gear,
                rpm = rpm,
                maxRpm = maxRpm,
                assists = {
                    tcs = telemetry.tcs_active or false,
                    abs = telemetry.abs_active or false,
                    esc = telemetry.esc_active or false
                }
            })
        else
            if isVisible then
                isVisible = false
                SendNUIMessage({ type = 'hide' })
            end
        end

        Citizen.Wait(sleep)
    end
end)
