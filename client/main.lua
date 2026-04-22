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
            local rpm = 0
            local maxRpm = 7000
            local assists = { tcs = false, abs = false, esc = false }

            pcall(function()
                rpm = exports["spz-physics"]:GetCurrentRPM() or 0
                local rpmData = exports["spz-physics"]:GetMinMaxRPM() or {}
                maxRpm = rpmData.max or 7000
                
                local telemetry = exports["spz-physics"]:GetTelemetry() or {}
                assists.tcs = telemetry.tcs_active or false
                assists.abs = telemetry.abs_active or false
                assists.esc = telemetry.esc_active or false
            end)
            
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
                assists = assists
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
