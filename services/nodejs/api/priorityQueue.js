class PriorityQueue {
  constructor(comparator = (a, b) => a < b) {
    this.heap = [];
    this.comparator = comparator;
  }

  getLeftChildIndex(parentIndex) { return 2 * parentIndex + 1; }
  getRightChildIndex(parentIndex) { return 2 * parentIndex + 2; }
  getParentIndex(childIndex) { return Math.floor((childIndex - 1) / 2); }

  hasParent(childIndex) { return this.getParentIndex(childIndex) >= 0; }
  hasLeftChild(parentIndex) { return this.getLeftChildIndex(parentIndex) < this.heap.length; }
  hasRightChild(parentIndex) { return this.getRightChildIndex(parentIndex) < this.heap.length; }

  leftChild(parentIndex) { return this.heap[this.getLeftChildIndex(parentIndex)]; }
  rightChild(parentIndex) { return this.heap[this.getRightChildIndex(parentIndex)]; }
  parent(childIndex) { return this.heap[this.getParentIndex(childIndex)]; }

  swap(indexOne, indexTwo) {
    [this.heap[indexOne], this.heap[indexTwo]] = [this.heap[indexTwo], this.heap[indexOne]];
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    if (this.isEmpty()) {
      throw new Error('Priority queue is empty');
    }
    return this.heap[0];
  }

  enqueue(element) {
    this.heap.push(element);
    this.heapifyUp();
  }

  dequeue() {
    if (this.isEmpty()) {
      throw new Error('Priority queue is empty');
    }
    const item = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown();
    return item;
  }

  heapifyUp() {
    let index = this.heap.length - 1;
    while (this.hasParent(index) && !this.comparator(this.parent(index), this.heap[index])) {
      this.swap(this.getParentIndex(index), index);
      index = this.getParentIndex(index);
    }
  }

  heapifyDown() {
    let index = 0;
    while (this.hasLeftChild(index)) {
      let smallerChildIndex = this.getLeftChildIndex(index);
      if (this.hasRightChild(index) && this.comparator(this.rightChild(index), this.leftChild(index))) {
        smallerChildIndex = this.getRightChildIndex(index);
      }

      if (this.comparator(this.heap[index], this.heap[smallerChildIndex])) {
        break;
      } else {
        this.swap(index, smallerChildIndex);
      }
      index = smallerChildIndex;
    }
  }
}

module.exports = { PriorityQueue };
