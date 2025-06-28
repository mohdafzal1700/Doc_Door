"use client"

import Header from "../components/home/Header"
import HeroSection from "../components/home/HeroSection"
import SecondaryHero from "../components/home/SecondaryHero"
import DoctorsSection from "../components/home/DoctorsSection"
import SpecialtiesSection from "../components/home/SpecialtiesSection"
import StatsSection from "../components/home/StatsSection"

const Home = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
      <Header />
      <HeroSection />
      <SecondaryHero />
      <DoctorsSection />
      <SpecialtiesSection />
      <StatsSection />
    </div>
  )
}

export default Home
