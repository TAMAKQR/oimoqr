import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon (Leaflet + bundler issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Компонент для обработки кликов по карте
const MapClickHandler = ({ onClick }) => {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
};

// Компонент для перемещения карты к координатам
const FlyToPosition = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 16, { duration: 1 });
        }
    }, [lat, lng, map]);
    return null;
};

/**
 * Интерактивный выбор точки на карте
 * @param {number} latitude - текущая широта
 * @param {number} longitude - текущая долгота
 * @param {number} radius - радиус доставки в км (для отрисовки круга)
 * @param {function} onChange - (lat, lng) => void
 */
const MapPicker = ({ latitude, longitude, radius, onChange, height = '300px' }) => {
    const lat = latitude ? Number(latitude) : null;
    const lng = longitude ? Number(longitude) : null;
    const center = lat && lng ? [lat, lng] : [42.87, 74.59]; // Default: Бишкек
    const zoom = lat && lng ? 16 : 12;

    const handleClick = (newLat, newLng) => {
        if (onChange) onChange(newLat, newLng);
    };

    return (
        <div className="relative z-0 rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onClick={handleClick} />
                {lat && lng && (
                    <>
                        <Marker position={[lat, lng]} />
                        <FlyToPosition lat={lat} lng={lng} />
                        {radius && (
                            <Circle
                                center={[lat, lng]}
                                radius={Number(radius) * 1000}
                                pathOptions={{
                                    color: '#374B6A',
                                    fillColor: '#374B6A',
                                    fillOpacity: 0.1,
                                    weight: 2
                                }}
                            />
                        )}
                    </>
                )}
            </MapContainer>
        </div>
    );
};

export default MapPicker;
