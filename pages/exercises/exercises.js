const ex = require('../../utils/exerciseData.js')

Page({
  data: {
    keyword: '',
    activeCat: '',
    categories: ex.categoryOptions(),
    list: [],
    expandedId: ''
  },
  onLoad() {
    this.refresh()
  },
  refresh() {
    const list = ex.list({
      keyword: this.data.keyword,
      bodyPart: this.data.activeCat
    })
    this.setData({ list })
  },
  onSearch(e) {
    this.setData({ keyword: e.detail.value }, () => this.refresh())
  },
  onCat(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ activeCat: this.data.activeCat === cat ? '' : cat }, () => this.refresh())
  },
  onToggle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? '' : id })
  }
})
