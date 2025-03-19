//==============================================================================
// Purpose: Buys suitable stocks and distribute them to workers to manage
//==============================================================================
class FilterParams {
  dataGetter; // function to fetch data to filter
  dataGetterParam; // parameters for dataGetter function
  batchSize; // number of stocks to retreive data using dataGetter function
  filterFunction; // funcion for filtering stock data

  constructor(df, ff, bs) {
    this.dataGetter = df;
    this.filterFunction = ff;
    this.batchSize = bs;
  }
}

export { FilterParams };
