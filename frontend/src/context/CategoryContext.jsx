import { createContext, useContext, useEffect, useState } from 'react';
import { getCategories } from '../api/categories';

const CategoryContext = createContext({ categories: [], loading: true });

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then((res) => {
      if (res.success) setCategories(res.data.items);
      setLoading(false);
    });
  }, []);

  return (
    <CategoryContext.Provider value={{ categories, loading }}>
      {children}
    </CategoryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCategories = () => useContext(CategoryContext);
