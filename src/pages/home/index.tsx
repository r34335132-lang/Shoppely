import { ScrollStack } from '@/components/motion/scroll-stack';
import { useBanners, useCategories, useProducts } from '@/hooks/queries';
import { demoBanners } from '@/lib/demo-data';
import { HeroPanel } from './hero-panel';
import { StoryPanel } from './story-panel';
import { CategoriesPanel } from './categories-panel';
import { ProductRail } from './product-rail';
import { ReviewsPanel } from './reviews-panel';
import { ContactPanel } from './contact-panel';

export default function HomePage() {
  const { data: banners = demoBanners } = useBanners();
  const { data: categories = [] } = useCategories();
  const { data: featured = [] } = useProducts({ featured: true, limit: 10 });

  const hero = banners.find((b) => b.placement === 'hero') ?? demoBanners[0];
  const stories = banners.filter((b) => b.placement === 'story');

  return (
    <>
      <ScrollStack overlapNext>
        <HeroPanel banner={hero} />
        {stories.map((banner, i) => (
          <StoryPanel key={banner.id} banner={banner} index={i} total={stories.length} />
        ))}
        {categories.length > 0 && <CategoriesPanel categories={categories} />}
      </ScrollStack>

      <ProductRail products={featured} />

      <div className="relative z-20 -mt-[100svh]">
        <ScrollStack>
          <ReviewsPanel />
          <ContactPanel />
        </ScrollStack>
      </div>
    </>
  );
}
