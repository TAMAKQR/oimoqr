import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

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
    return (
      <div className="w-full h-64 bg-gradient-to-r from-primary-500 to-primary-700 flex items-center justify-center">
        <p className="text-white text-xl">Добро пожаловать в наше меню</p>
      </div>
    );
  }

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      spaceBetween={0}
      slidesPerView={1}
      autoplay={{
        delay: 3000,
        disableOnInteraction: false,
      }}
      pagination={{ clickable: true }}
      loop={parsedBanners.length > 1}
      className="w-full h-64 md:h-96"
    >
      {parsedBanners.map((banner, index) => (
        <SwiperSlide key={index}>
          <img
            src={banner}
            alt={`Banner ${index + 1}`}
            loading={index === 0 ? "eager" : "lazy"}
            className="w-full h-full object-cover"
          />
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default BannerSlider;