import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useT } from '../hooks/useT';
import { MapPin, Calendar, Tag, ArrowLeft, Clock } from 'lucide-react';
import * as eventService from '../utils/eventService';
import { Item } from '../utils/dataService';

export function SearchResultsPage() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || '';
  const category = searchParams.get('category') || '';
  const query = searchParams.get('q') || ''; // Search query text

  useEffect(() => {
    async function fetchSearchResults() {
      setLoading(true);
      
      try {
        // Fetch all upcoming events
        const events = await eventService.getEvents('upcoming', city || undefined);
        
        let filteredResults = events;
        
        // Filter by search query (title or description)
        if (query) {
          const lowerQuery = query.toLowerCase();
          filteredResults = filteredResults.filter(event => {
            const titleMatch = (language === 'sr' ? event.title : (event.title_en || event.title))
              .toLowerCase()
              .includes(lowerQuery);
            const descMatch = (language === 'sr' ? event.description : (event.description_en || event.description))
              .toLowerCase()
              .includes(lowerQuery);
            const categoryMatch = (event.event_type || event.page_slug || '').toLowerCase().includes(lowerQuery);
            
            return titleMatch || descMatch || categoryMatch;
          });
        }
        
        // Filter by category if specified
        if (category) {
          filteredResults = filteredResults.filter(event => {
            const eventCategory = (event.event_type || event.page_slug || '').toLowerCase();
            return eventCategory.includes(category.toLowerCase());
          });
        }
        
        setResults(filteredResults);
      } catch (error) {
        console.error('Error fetching search results:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSearchResults();
  }, [city, date, category, query, language]);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mb-6 text-gray-600 hover:text-blue-600 transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <ArrowLeft size={20} />
          <span style={{ fontSize: '15px', fontWeight: 500 }}>
            {language === 'sr' ? 'Nazad na početnu' : 'Back to Home'}
          </span>
        </button>

        {/* Info Box if no filters selected */}
        {!city && !date && !category && !query && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <p className="text-center text-gray-700" style={{ fontSize: '15px' }}>
              {language === 'sr' 
                ? 'Unesite pojam za pretragu ili izaberite grad, datum ili kategoriju da biste filtrirali rezultate.'
                : 'Enter a search term or select a city, date, or category to filter your results.'}
            </p>
          </div>
        )}

        {/* Search Summary */}
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>
            {language === 'sr' ? 'Rezultati pretrage' : 'Search Results'}
          </h1>
          {!loading && (
            <p className="text-gray-600 mb-3 md:mb-4" style={{ fontSize: '14px' }}>
              {language === 'sr' 
                ? `Pronađeno ${results.length} rezultata${query ? ` za "${query}"` : ''}`
                : `Found ${results.length} result${results.length !== 1 ? 's' : ''}${query ? ` for "${query}"` : ''}`
              }
            </p>
          )}
          
          <div className="flex flex-wrap gap-2 md:gap-3">
            {query && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                <Tag size={18} style={{ color: '#0E3DC5' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                  {query}
                </span>
              </div>
            )}
            
            {city && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                <MapPin size={18} style={{ color: '#0E3DC5' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                  {city}
                </span>
              </div>
            )}
            
            {date && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                <Calendar size={18} style={{ color: '#0E3DC5' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                  {date}
                </span>
              </div>
            )}
            
            {category && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                <Tag size={18} style={{ color: '#0E3DC5' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                  {category}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">
              {language === 'sr' ? 'Učitavanje...' : 'Loading...'}
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              {language === 'sr' ? 'Nema rezultata za vašu pretragu' : 'No results found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer block"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  <img
                    src={event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800'}
                    alt={language === 'sr' ? event.title : (event.title_en || event.title)}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-3 right-3 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {eventService.translateEventType(event.event_type || event.page_slug || 'event', language)}
                  </div>
                  {event.price === 'Free' && (
                    <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      {language === 'sr' ? 'Besplatno' : 'Free'}
                    </div>
                  )}
                </div>
                
                <div className="p-5">
                  <h3 className="text-lg font-bold mb-2 line-clamp-2" style={{ color: '#1a1a1a' }}>
                    {language === 'sr' ? event.title : (event.title_en || event.title)}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {language === 'sr' ? event.description : (event.description_en || event.description)}
                  </p>
                  
                  <div className="space-y-2">
                    {event.start_at && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar size={14} />
                        <span>{eventService.getRelativeDateLabel(event.start_at, language)}</span>
                      </div>
                    )}
                    
                    {event.start_at && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock size={14} />
                        <span>{eventService.formatEventTime(event.start_at, event.end_at)}</span>
                      </div>
                    )}
                    
                    {event.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin size={14} />
                        <span>{event.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}