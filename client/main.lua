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

            -- Native Data
            local rpm = GetVehicleCurrentRpm(vehicle)
            local maxRpm = 1.0
            local gear = GetVehicleCurrentGear(vehicle)
            local speed = math.floor(GetEntitySpeed(vehicle) * 3.6)

            -- Dashboard Indicators
            local _, lights, highbeams = GetVehicleLightsState(vehicle)
            local blinkers = GetVehicleIndicatorLights(vehicle)
            local status = {
                leftBlinker = (blinkers == 1 or blinkers == 3),
                rightBlinker = (blinkers == 2 or blinkers == 3),
                lights = lights == 1,
                highbeams = highbeams == 1,
                handbrake = GetVehicleHandbrake(vehicle),
            }

            -- Get NOS data
            local nosData = nil
            pcall(function()
                nosData = exports["spz-nos"]:GetNosData()
            end)

            -- Send to NUI
            SendNUIMessage({
                type = 'update',
                speed = speed,
                gear = gear,
                rpm = rpm,
                maxRpm = maxRpm,
                status = status,
                nos = nosData
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
