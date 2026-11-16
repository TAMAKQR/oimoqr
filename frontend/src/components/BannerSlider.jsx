import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { cacheBustImage } from '../utils/imageCache';
import ImageWithLoader from './ImageWithLoader';

const BannerSlider = ({ banners }) => {
  // Parse banners if it's a JSON string (SQLite compatibility)
  let parsedBanners = banners;
  if (typeof banners === 'string') {
    try {
      parsedBanners = JSON.parse(banners);
    } catch (e) {
      parsedBanners = [];
    }
  }

  if (!parsedBanners || !Array.isArray(parsedBanners) || parsedBanners.length === 0) {
    return null;
  }

  return (
    <Swiper
      modules={[Pagination]}
      spaceBetween={0}
      slidesPerView={1}
      pagination={{ clickable: true }}
      loop={parsedBanners.length > 1}
      className="h-40 w-full sm:h-48 lg:h-56"
    >
      {parsedBanners.map((banner, index) => (
        <SwiperSlide key={index}>
          <div className="w-full h-full">
            <ImageWithLoader
              src={cacheBustImage(banner, { width: 1440, quality: 'auto:good' })}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              className="w-full h-full object-cover"
            />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default BannerSlider;
